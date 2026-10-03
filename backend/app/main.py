import os
from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
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
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hostnames,
)
app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads",
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


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