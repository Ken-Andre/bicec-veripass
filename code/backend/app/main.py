import time
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError

from app.api.v1.router import api_router
from app.routers.demo import router as demo_router
from app.core.config import settings

# Sentry Init
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        send_default_pii=True,
        traces_sample_rate=0.1,
        environment=settings.ENVIRONMENT,
        release=f"{settings.PROJECT_NAME}@{settings.PROJECT_VERSION}",
    )
from app.core.logging import logger
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler
)
from app.core.rate_limit import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.db.session import check_db_connection, AsyncSessionLocal
from app.core.redis import check_redis_connection

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up BICEC VeriPass API...")
    # Check DB connection
    db_ok = await check_db_connection()
    if not db_ok:
        logger.error("Failed to connect to Database on startup.")

    # Seed development data if enabled
    if settings.ENVIRONMENT == "development" or getattr(settings, "SEED_DATA", False):
        try:
            from app.db.seed_data import seed_development_data
            async with AsyncSessionLocal() as db:
                await seed_development_data(db)
        except Exception as e:
            logger.warning(f"Seed data failed (non-fatal): {e}")

    yield
    # Shutdown
    logger.info("Shutting down BICEC VeriPass API...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)
app.state.limiter = limiter

# Exception Handlers
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    # Get correlation ID from header or generate one
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    
    # Add to request state for use in logging/other places
    request.state.correlation_id = correlation_id
    
    # Process request
    start_time = time.time()
    response: Response = await call_next(request)
    process_time = time.time() - start_time
    
    # Add to response headers
    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Process-Time"] = str(process_time)
    
    return response

# Routes
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix="/api/v1")

@app.get("/api/health", tags=["health"])
async def health_check():
    db_status = await check_db_connection()
    redis_status = await check_redis_connection()
    
    status = "ok" if db_status and redis_status else "degraded"
    
    return {
        "status": status,
        "version": "0.1.0",
        "db": "ok" if db_status else "error",
        "redis": "ok" if redis_status else "error"
    }

@app.get("/api/sentry-debug", tags=["sentry"])
async def trigger_error():
    """Sentry test endpoint — intentionally raises ZeroDivisionError."""
    division_by_zero = 1 / 0
