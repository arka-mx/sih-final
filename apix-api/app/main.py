from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
from app.config import settings
from app.db import init_db
from app.rate_limit import RateLimitMiddleware
from app.routers import (
    index,
    routes,
    backtest,
    public,
    metadata,
    health,
    sources,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables and seed baseline data
    await init_db()
    yield


app = FastAPI(
    title="APIx - Real-Time Airfare Price Index API",
    description="""
### Ministry of Statistics & Programme Implementation (MoSPI)
**Data Informatics & Innovation Division (DIID)**  
*Smart Automation Problem Statement 26056: Real-time Airfare Price Index (APIx) for India*

This API layer provides automated, statistically sound airfare price index metrics to augment 
the **Transport and Communication** sub-group of the Consumer Price Index (CPI) for MoSPI/NSO 
and the Reserve Bank of India (RBI) Monetary Policy Department.
""",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Custom RFC 7807 exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "type" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail,
            headers={"Content-Type": "application/problem+json"},
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": "https://errors.apix.mospi.gov.in/http-error",
            "title": "HTTP Error",
            "status": exc.status_code,
            "detail": str(exc.detail),
            "instance": str(request.url.path),
        },
        headers={"Content-Type": "application/problem+json"},
    )


# Include Routers
app.include_router(public.router)
app.include_router(index.router)
app.include_router(routes.router)
app.include_router(sources.router)
app.include_router(backtest.router)
app.include_router(metadata.router)
app.include_router(health.router)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "Enter your authorized MoSPI/RBI API key (e.g. `mospi-nso-key-2026` or `rbi-mpd-key-2026`)",
        },
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "description": "Alternative Bearer token authentication.",
        },
    }

    public_paths = ["/api/public/summary", "/api/health", "/docs", "/redoc", "/openapi.json", "/api/sources/compare"]
    for path, path_item in openapi_schema.get("paths", {}).items():
        if path not in public_paths:
            for method in path_item:
                path_item[method]["security"] = [
                    {"ApiKeyAuth": []},
                    {"BearerAuth": []},
                ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
