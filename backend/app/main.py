import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth
from app.routers import properties
from app.routers import health
from fastapi.staticfiles import StaticFiles
from app.routers import property_photos
from app.routers import messages

os.makedirs("uploads", exist_ok=True)
app = FastAPI(
    title="NyumbaDirect API",
    description="Direct connection between house hunters and landlords/property managers.",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "https://nyumba-direct-rust.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount(
    "/uploads",
    StaticFiles(directory="uploads"),
    name="uploads",
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(property_photos.router)
app.include_router(messages.router)