from typing import List
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "BICEC VeriPass"
    PROJECT_VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Database - with defaults for dev/test
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/veripass"

    # Redis - with defaults for dev/test
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security - with default for dev/test
    JWT_SECRET: str = "dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 24 * 60

    # Application
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SEED_DATA: bool = False  # Force seed even outside development

    # Sentry
    SENTRY_DSN: str = ""

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_OTP: str = "3/minute"
    RATE_LIMIT_ADMIN: str = "30/minute"

    # CORS - simplified validator
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Storage
    STORAGE_PATH: str = "/data/documents"  # Docker volume mount in production
    STORAGE_PATH_DEV: str = "./data/documents"  # Local development fallback
    MODELS_PATH: str = "/data/models"

    # Allowed file types and max size
    ALLOWED_DOCUMENT_TYPES: List[str] = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
    ]
    MAX_DOCUMENT_SIZE_MB: int = 10  # 10MB max per document
    # TODO: consider reducing to 2MB once client-side compression is validated

    # Backup
    # ENABLE_BACKUPS: set to True only when backup infrastructure is configured.
    # Prevents accidental task execution in dev/CI without a backup target.
    ENABLE_BACKUPS: bool = False
    BACKUP_RETENTION_DAYS: int = 7
    # BACKUP_ENCRYPTION_KEY: dedicated AES-256 passphrase for GPG-encrypted image archives.
    # MUST be distinct from JWT_SECRET. Set via secrets manager in production.
    BACKUP_ENCRYPTION_KEY: str = ""

    # IA / OCR
    # Confidence threshold: minimum required to accept OCR without fallback
    OCR_CONFIDENCE_THRESHOLD: float = 0.90
    # User edit threshold: below this, user can modify the extracted value
    OCR_USER_EDIT_THRESHOLD: float = 0.95
    PADDLE_LAZY_LOAD: bool = True
    PADDLE_USE_GPU: bool = False
    PADDLE_LANG: str = "french"
    OCR_MODELS_ROOT: str = "/opt/models-offline"
    PADDLE_OFFLINE: bool = True
    PADDLE_DET_MODEL_DIR: str = ""
    PADDLE_REC_MODEL_DIR: str = ""
    PADDLE_CLS_MODEL_DIR: str = ""
    PADDLE_CACHE_DIR: str = "/tmp/paddle-cache"
    PADDLE_WARMUP_ON_START: bool = True  # Warmup predict() on startup to avoid first-call garbage
    OCR_IMAGE_WIDTH: int = 600  # Image width for OCR pipeline (600=2x faster than 800, same field quality)
    GLM_OCR_QUEUE: str = "glm_ocr_jobs"
    GLM_OCR_ENABLED: bool = True
    GLM_OCR_CLI_PATH: str = ""
    GLM_OCR_MODEL_PATH: str = ""
    GLM_OCR_MMPROJ_PATH: str = ""
    GLM_OCR_TIMEOUT_SECONDS: int = 90
    OCR_GLM_FALLBACK_MIN_FIELDS: int = 2
    FACE_MATCH_MIN_SCORE: float = 0.8
    ANTI_SPOOFING_MIN_SCORE: float = 0.7
    DEEPFACE_DETECTOR_BACKEND: str = "opencv"  # opencv for MVP RAM budget; retinaface can be enabled on larger hosts
    MINIFASNET_ENABLED: bool = True
    MINIFASNET_MODEL_PATH: str = "/opt/models-offline/minifasnet/MiniFASNetV2.onnx"
    MINIFASNET_MODEL_SHA256: str = ""
    MINIFASNET_CROP_SCALE: float = 2.7
    MINIFASNET_INPUT_SIZE: int = 80
    MINIFASNET_LIVE_CLASS_INDEX: int = 1

    # Orange SMS API
    ORANGE_CLIENT_ID: str = ""
    ORANGE_CLIENT_SECRET: str = ""
    ORANGE_AUTH_HEADER_BASIC: str = ""
    ORANGE_BASE_URL: str = "https://api.orange.com"
    ORANGE_SENDER_NAME: str = "VeriPass"
    ORANGE_SENDER_PHONE: str = ""

    # Email Configuration
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = False
    SMTP_SSL: bool = False
    SMTP_FROM: str = "noreply@bicec-veripass.cm"

    # OTP Configuration
    # Modes: "orange" (SMS), "email" (direct Email if preferred), "dev_local" (logs only)
    OTP_MODE: str = "orange"
    OTP_FALLBACK_EMAIL: bool = (
        True  # If SMS fails, try Email if user has an email recorded
    )
    OTP_FALLBACK_EMAIL_ADDRESS: str = (
        ""  # Fallback email for dev/staging when user has no email
    )
    OTP_EXPIRY_MINUTES: int = 10  # Aligned with ADR-016 (10 min)

    # Redis TTL (secondes)  Required by ADR-016
    REDIS_OTP_TTL: int = 600  # 10 min  AUTH-03
    REDIS_OTP_ATTEMPTS_TTL: int = 600  # 10 min  AUTH-03
    REDIS_REFRESH_TOKEN_TTL: int = 604800  # 7 jours  AUTH-02
    REDIS_RATELIMIT_OTP_TTL: int = 600  # 10 min  ADMIN-01
    REDIS_RATELIMIT_AUTH_TTL: int = 60  # 1 min  ADMIN-01
    REDIS_RATELIMIT_GLOBAL_TTL: int = 60  # 1 min  ADMIN-01
    REDIS_LOCK_OCR_TTL: int = 120  # sécurité  ADR-003
    REDIS_LOCK_GLM_TTL: int = 300  # sécurité  ADR-003
    REDIS_LOCK_AGENT_TTL: int = 30  # sécurité  12.3
    REDIS_ANALYTICS_CACHE_TTL: int = 60  # ANALYTICS-12

    @field_validator("OTP_MODE", mode="after")
    @classmethod
    def validate_otp_mode(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production" and v == "dev_local":
            raise ValueError(
                "OTP_MODE 'dev_local' is NOT allowed in production environment"
            )
        return v

    @field_validator("JWT_SECRET", mode="after")
    @classmethod
    def validate_jwt_secret(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production" and v == "dev-secret-change-in-production":
            raise ValueError("JWT_SECRET MUST be changed in production")
        if env == "production" and len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters in production")
        return v

    @field_validator("BACKUP_ENCRYPTION_KEY", mode="after")
    @classmethod
    def validate_backup_key(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development")
        enable = info.data.get("ENABLE_BACKUPS", False)
        if env == "production" and enable and not v:
            raise ValueError(
                "BACKUP_ENCRYPTION_KEY must be set when ENABLE_BACKUPS=true in production"
            )
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v) -> list:
        import os

        if isinstance(v, str):
            origins = [i.strip() for i in v.split(",") if i.strip()]
            env = os.getenv("ENVIRONMENT", "development")
            if env == "production" and "*" in origins:
                raise ValueError("CORS wildcards not allowed in production")
            return origins
        return v

    model_config = SettingsConfigDict(
        case_sensitive=True, env_file=".env", extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """Lazy loading of settings to avoid import-time validation errors."""
    return Settings()


# For backward compatibility
settings = get_settings()
