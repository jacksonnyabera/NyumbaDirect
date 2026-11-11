"""Rate limiting for NyumbaDirect.

Backends
--------
* Redis (REDIS_URL set): fixed-window counters shared by every instance. This
  is the only mode that gives distributed protection on a multi-instance
  Render deployment.
* In-memory fallback (REDIS_URL empty, or Redis temporarily unreachable):
  counters live inside one process. Each instance counts separately, so the
  effective limit is roughly ``limit x instances``. It still slows a single
  attacker hitting one instance, but it is NOT distributed protection and the
  app logs a warning at startup and when Redis fails.

Client IP
---------
The client IP is derived from X-Forwarded-For using TRUSTED_PROXY_COUNT, i.e.
the entry that the Nth trusted proxy appended (counting from the right). Any
entries the client put in front of that are ignored, so sending a forged
X-Forwarded-For does not change the IP used for limiting.
"""

import ipaddress
import logging
import threading
import time
from dataclasses import dataclass

from fastapi import HTTPException, Request, Response

from app.config import settings
from app.security import decode_access_token

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Hit:
    count: int
    reset_in: int  # seconds until the window resets


class MemoryBackend:
    name = "memory"

    def __init__(self) -> None:
        self._data: dict[str, tuple[int, float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def hit(self, key: str, window: int) -> Hit:
        now = time.monotonic()
        with self._lock:
            if now - self._last_sweep > 60:
                self._data = {k: v for k, v in self._data.items() if v[1] > now}
                self._last_sweep = now
            count, expires = self._data.get(key, (0, 0.0))
            if expires <= now:
                count, expires = 0, now + window
            count += 1
            self._data[key] = (count, expires)
            return Hit(count, max(1, int(expires - now)))

    def reset(self) -> None:
        with self._lock:
            self._data.clear()


class RedisBackend:
    name = "redis"

    def __init__(self, url: str) -> None:
        import redis  # imported lazily so the fallback works without it

        self._client = redis.Redis.from_url(
            url,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
            decode_responses=True,
        )

    def hit(self, key: str, window: int) -> Hit:
        pipe = self._client.pipeline()
        pipe.incr(key)
        pipe.ttl(key)
        count, ttl = pipe.execute()
        if ttl is None or ttl < 0:
            # First hit in the window (or a key that lost its TTL).
            self._client.expire(key, window)
            ttl = window
        return Hit(int(count), max(1, int(ttl)))


_memory = MemoryBackend()
_redis: RedisBackend | None = None
_warned_fallback = False
_last_redis_error_log = 0.0


def _get_redis() -> RedisBackend | None:
    global _redis
    if not settings.redis_url:
        return None
    if _redis is None:
        try:
            _redis = RedisBackend(settings.redis_url)
        except Exception:
            logger.exception("Could not initialise Redis rate limiter")
            return None
    return _redis


def backend_description() -> str:
    return "redis" if settings.redis_url else "memory (per-process, NOT distributed)"


def warn_if_not_distributed() -> None:
    if settings.rate_limit_enabled and not settings.redis_url:
        logger.warning(
            "REDIS_URL is not set: rate limits are enforced per process only "
            "and are not shared across instances. Set REDIS_URL for production."
        )


def _hit(key: str, window: int) -> Hit:
    global _last_redis_error_log
    backend = _get_redis()
    if backend is not None:
        try:
            return backend.hit(key, window)
        except Exception as exc:
            now = time.monotonic()
            if now - _last_redis_error_log > 60:
                _last_redis_error_log = now
                logger.error(
                    "Redis rate limiter unavailable (%s); using per-process fallback",
                    type(exc).__name__,
                )
    return _memory.hit(key, window)


def reset_for_tests() -> None:
    _memory.reset()


def get_client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    proxies = settings.trusted_proxy_count
    if proxies > 0:
        forwarded = request.headers.get("x-forwarded-for", "")
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if len(parts) >= proxies:
            candidate = parts[-proxies]
            try:
                return str(ipaddress.ip_address(candidate))
            except ValueError:
                pass
    return peer


def _user_subject(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        payload = decode_access_token(header[7:].strip())
        if payload and payload.get("sub") is not None:
            return f"u{payload['sub']}"
    return None


def check_rate_limit(
    request: Request,
    response: Response | None,
    name: str,
    limit: int,
    window: int,
    subject: str | None = None,
) -> None:
    """Count one hit; raise HTTP 429 once ``limit`` is exceeded."""
    if not settings.rate_limit_enabled:
        return

    who = subject or get_client_ip(request)
    result = _hit(f"rl:{name}:{who}", window)
    remaining = max(0, limit - result.count)
    headers = {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Reset": str(result.reset_in),
    }

    if result.count > limit:
        logger.warning("rate limit exceeded rule=%s", name)
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment and try again.",
            headers={**headers, "Retry-After": str(result.reset_in)},
        )

    if response is not None:
        for header, value in headers.items():
            response.headers[header] = value


def rate_limit(name: str, limit: int, window: int, per_user: bool = False):
    """FastAPI dependency. ``per_user`` keys on the signed-in user if present
    (falling back to client IP), otherwise it keys on client IP."""

    def dependency(request: Request, response: Response) -> None:
        subject = _user_subject(request) if per_user else None
        check_rate_limit(request, response, name, limit, window, subject)

    return dependency
