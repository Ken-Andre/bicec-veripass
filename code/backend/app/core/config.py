from typing import List, Union
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "BICEC VeriPass"
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
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_OTP: str = "3/minute"
    RATE_LIMIT_ADMIN: str = "30/minute"
    
    # CORS - simplified validator
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Storage
    STORAGE_PATH: str = "./data/storage"
    
    # IA / OCR
    OCR_CONFIDENCE_THRESHOLD: float = 0.85
    PADDLE_LAZY_LOAD: bool = True
    
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
    OTP_FALLBACK_EMAIL: bool = True  # If SMS fails, try Email if user has an email recorded
    OTP_FALLBACK_EMAIL_ADDRESS: str = ""  # Fallback email for dev/staging when user has no email
    OTP_EXPIRY_MINUTES: int = 5      # Aligned with ADR-016 (5 min)

    # Redis TTL (secondes) — Required by ADR-016
    REDIS_OTP_TTL: int = 300           # 5 min — AUTH-03
    REDIS_OTP_ATTEMPTS_TTL: int = 300  # 5 min — AUTH-03
    REDIS_REFRESH_TOKEN_TTL: int = 604800  # 7 jours — AUTH-02
    REDIS_RATELIMIT_OTP_TTL: int = 300     # 5 min — ADMIN-01
    REDIS_RATELIMIT_AUTH_TTL: int = 60     # 1 min — ADMIN-01
    REDIS_RATELIMIT_GLOBAL_TTL: int = 60   # 1 min — ADMIN-01
    REDIS_LOCK_OCR_TTL: int = 120          # sécurité — ADR-003
    REDIS_LOCK_GLM_TTL: int = 300          # sécurité — ADR-003
    REDIS_LOCK_AGENT_TTL: int = 30         # sécurité — §12.3
    REDIS_ANALYTICS_CACHE_TTL: int = 60    # ANALYTICS-12

    @field_validator("OTP_MODE", mode="after")
    @classmethod
    def validate_otp_mode(cls, v: str, info) -> str:
        # Avoid circular import issues by accessing info.data
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production" and v == "dev_local":
            raise ValueError("OTP_MODE 'dev_local' is NOT allowed in production environment")
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
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )

@lru_cache()
def get_settings() -> Settings:
    """Lazy loading of settings to avoid import-time validation errors."""
    return Settings()

# For backward compatibility
settings = get_settings()
