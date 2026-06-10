import os
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
from app.core.sentry import before_send
from app.core.metrics import metrics_registry, monotonic_seconds

# Sentry Init (skip if SKIP_SENTRY=1, needed for tests with Python 3.14)
if settings.SENTRY_DSN and not os.getenv("SKIP_SENTRY"):
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        send_default_pii=True,
        traces_sample_rate=0.1,
        environment=settings.ENVIRONMENT,
        release=f"{settings.PROJECT_NAME}@{settings.PROJECT_VERSION}",
        before_send=before_send,
    )
from app.core.logging import logger
from app.core.exceptions import (
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler,
)
from app.core.rate_limit import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.db.session import check_db_connection, AsyncSessionLocal
from app.core.redis import check_redis_connection
from app.modules.kyc.service import get_shared_paddle_ocr


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

    if settings.PADDLE_WARMUP_ON_START:
        # Step 1: Load PaddleOCR model — this is REQUIRED for the app to function.
        ocr = get_shared_paddle_ocr()
        if ocr is None:
            raise RuntimeError("PaddleOCR is unavailable — cannot start without OCR engine")

        # Step 2: Run predict() warmup on a synthetic text image — non-fatal.
        # This triggers internal JIT compilation and memory allocation in BOTH
        # the detection and recognition sub-models. Without this, the first
        # real OCR request returns garbage results (e.g. nom=DSCHANG instead
        # of KANA). A pure noise/black image short-circuits detection, leaving
        # recognition unwarmed — we need actual text.
        try:
            from app.services.ocr_service import generate_warmup_image
            _warmup_img = generate_warmup_image()
            _warmup_start = time.perf_counter()
            _ = ocr.predict(_warmup_img)
            _warmup_ms = (time.perf_counter() - _warmup_start) * 1000
            logger.info(
                f"PaddleOCR warmup on startup complete "
                f"(model load + predict={_warmup_ms:.0f}ms)"
            )
        except Exception as e:
            # Don't crash the entire app if warmup predict() fails —
            # the model IS loaded and functional, just not warmed up.
            # The first real request may return garbage, but the app still serves.
            logger.error(
                f"PaddleOCR predict warmup failed (non-fatal): {e}. "
                "First OCR request may return garbage."
            )

    yield
    # Shutdown
    logger.info("Shutting down BICEC VeriPass API...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
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


@app.middleware("http")
async def collect_http_metrics(request: Request, call_next):
    start_time = monotonic_seconds()
    response: Response = await call_next(request)
    path = request.url.path
    if path != "/metrics":
        metrics_registry.record_http_request(
            method=request.method,
            path=path,
            status_code=response.status_code,
            duration_seconds=monotonic_seconds() - start_time,
        )
    return response


# Routes
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix="/api/v1")


@app.get("/metrics", tags=["monitoring"])
async def prometheus_metrics():
    return Response(
        content=metrics_registry.render(
            app_name=settings.PROJECT_NAME,
            version=settings.PROJECT_VERSION,
        ),
        media_type="text/plain; version=0.0.4",
    )


@app.get("/api/health", tags=["health"])
async def health_check():
    db_status = await check_db_connection()
    redis_status = await check_redis_connection()

    status = "ok" if db_status and redis_status else "degraded"

    return {
        "status": status,
        "version": "0.1.0",
        "db": "ok" if db_status else "error",
        "redis": "ok" if redis_status else "error",
    }
