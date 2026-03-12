from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routes import (
    profile,
    claims,
    verify,
    organizations,
    employer,
    notifications,
    lookup,
    invite,
    settings,
)

app_settings = get_settings()

app = FastAPI(
    title="Stamp API",
    description="Verified professional identity platform",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        app_settings.frontend_url,
        app_settings.frontend_url.replace("://", "://www."),
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# User-facing routes
app.include_router(profile.router)
app.include_router(claims.router)
app.include_router(notifications.router)
app.include_router(invite.router)
app.include_router(settings.router)

# Organization & employer routes
app.include_router(organizations.router)
app.include_router(employer.router)
app.include_router(verify.router)

# Lookup routes (Clearbit + HIPO)
app.include_router(lookup.router)


@app.get("/")
async def root():
    return {"name": "Stamp API", "version": "2.0.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
