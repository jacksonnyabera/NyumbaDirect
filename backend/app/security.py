import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from pwdlib import PasswordHash

from app.config import settings


password_hash = PasswordHash.recommended()

# A valid hash of a random value, used to spend the same time verifying a
# password when the account does not exist (prevents login timing leaks).
_DUMMY_HASH = password_hash.hash(uuid.uuid4().hex)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    return password_hash.verify(
        plain_password,
        hashed_password,
    )


def verify_dummy_password(plain_password: str) -> None:
    """Burn the same CPU time as a real verification; result is discarded."""
    try:
        password_hash.verify(plain_password, _DUMMY_HASH)
    except Exception:  # pragma: no cover - defensive
        pass


def _encode(payload: dict) -> str:
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def _decode(token: str) -> dict | None:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            # iss/aud are checked by _claims_ok so legacy tokens keep working.
            options={"verify_aud": False, "verify_iss": False},
        )
    except JWTError:
        return None


def _claims_ok(payload: dict) -> bool:
    issuer = payload.get("iss")
    audience = payload.get("aud")
    if issuer is None and audience is None:
        return not settings.jwt_require_claims
    return issuer == settings.jwt_issuer and audience == settings.jwt_audience


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update(
        {
            "exp": expire,
            "iat": now,
            "jti": uuid.uuid4().hex,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "type": "access",
        }
    )
    return _encode(to_encode)


def decode_access_token(token: str) -> dict | None:
    payload = _decode(token)
    if payload is None:
        return None

    # Accept legacy access tokens (no "type") until they expire, but reject
    # signed verification and password-reset tokens on authenticated routes.
    if payload.get("type") not in (None, "access"):
        return None

    if not _claims_ok(payload):
        return None

    return payload


def create_email_verification_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    return _encode(
        {
            "sub": email,
            "type": "email_verification",
            "exp": expire,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        }
    )


def decode_email_verification_token(token: str) -> dict | None:
    payload = _decode(token)
    if payload is None or payload.get("type") != "email_verification":
        return None
    if not _claims_ok(payload):
        return None
    return payload


def password_fingerprint(stored_password_hash: str) -> str:
    """Keyed fingerprint of the current password hash.

    Embedded in reset tokens: once the password changes the fingerprint no
    longer matches, so a reset link can be used exactly once.
    """
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        stored_password_hash.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]


def create_password_reset_token(email: str, stored_password_hash: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.password_reset_ttl_minutes
    )
    return _encode(
        {
            "sub": email,
            "type": "password_reset",
            "fp": password_fingerprint(stored_password_hash),
            "jti": uuid.uuid4().hex,
            "exp": expire,
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        }
    )


def decode_password_reset_token(token: str) -> dict | None:
    payload = _decode(token)
    if payload is None or payload.get("type") != "password_reset":
        return None
    # Reset tokens always require the new claims; the old format had no
    # fingerprint and cannot be made single-use, so it is rejected.
    if payload.get("iss") != settings.jwt_issuer or payload.get("aud") != settings.jwt_audience:
        return None
    if not isinstance(payload.get("fp"), str):
        return None
    return payload


def reset_token_matches_password(payload: dict, stored_password_hash: str) -> bool:
    return hmac.compare_digest(
        str(payload.get("fp", "")),
        password_fingerprint(stored_password_hash),
    )
