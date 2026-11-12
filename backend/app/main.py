import logging
import os
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app import log_redaction
from app.rate_limit import warn_if_not_distributed
from app.routers import auth
from app.routers import properties
from app.routers import health
from fastapi.staticfiles import StaticFiles
from app.routers import property_photos
from app.routers import messages
from app.routers.promotions import router as promotions_router
from app.routers.payments import router as payments_router
from app.routers import verification
from app.routers import assistant
from app.routers import favorites
from app.routers import reviews
from app.routers.admin_dashboard import router as admin_dashboard_router
from app.routers.admin_verification import router as admin_verification_router

os.makedirs("uploads", exist_ok=True)
is_production = settings.app_env.casefold() in {"production", "prod"}
app = FastAPI(
    title="NyumbaDirect API",
    description="Direct connection between house hunters and landlords/property managers.",
    version="1.0.0",
    debug=settings.debug and not is_production,
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

BASE_CORS_ORIGINS = [
    "https://www.nyumbadirect.co.ke",
    "https://nyumbadirect.co.ke",
    "https://nyumba-direct-rust.vercel.app",
]
DEV_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]
cors_origins = BASE_CORS_ORIGINS + [
    origin.strip()
    for origin in settings.cors_extra_origins.split(",")
    if origin.strip()
]
if not is_production:
    cors_origins += DEV_CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # The API authenticates with an Authorization header, not cookies, so
    # credentialed cross-origin requests are not needed.
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
    ],
    max_age=600,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hostnames,
)
app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads",
)


class BodySizeLimitMiddleware:
    """Reject oversized request bodies before they are buffered or parsed."""

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def _too_large(self, send):
        body = b'{"detail":"Request body is too large."}'
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None:
            try:
                if int(declared) > self.max_bytes:
                    await self._too_large(send)
                    return
            except ValueError:
                await self._too_large(send)
                return

        received = 0
        started = False

        async def counting_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except _BodyTooLarge:
            if not started:
                await self._too_large(send)


class _BodyTooLarge(Exception):
    pass


app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_body_bytes)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "geolocation=(), camera=(), microphone=(), payment=()"
    )
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    # Anything carrying credentials or private data must never be cached by a
    # shared cache or served to another user.
    if request.headers.get("authorization") or request.url.path.startswith(
        ("/auth", "/payments", "/messages")
    ):
        response.headers["Cache-Control"] = "no-store"
    if is_production:
        # The API only returns JSON, so lock down everything. (Not applied
        # outside production because the /docs UI needs external scripts.)
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response



warn_if_not_distributed()
log_redaction.install()

if is_production and not settings.mpesa_verify_callbacks:
    logging.getLogger(__name__).warning(
        "MPESA_VERIFY_CALLBACKS is off in production: boosts are activated from "
        "unconfirmed callbacks. Turn it on."
    )

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(property_photos.router)
app.include_router(messages.router)
app.include_router(promotions_router)
app.include_router(payments_router)
app.include_router(verification.router)
app.include_router(assistant.router)
app.include_router(favorites.router)
app.include_router(reviews.router)
app.include_router(admin_dashboard_router)
app.include_router(admin_verification_router)
@app.get("/")
def root():
    return {
        "message": "NyumbaDirect API is running",
        "status": "ok",
    }