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
    
    # CORS - simplified validator
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

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
    
    # OTP Configuration
    # Modes: "orange" (real SMS), "dev_local" (console logs only)
    OTP_MODE: str = "orange"
    OTP_EXPIRY_MINUTES: int = 10

    @field_validator("OTP_MODE", mode="after")
    @classmethod
    def validate_otp_mode(cls, v: str, info) -> str:
        # Avoid circular import issues by accessing info.data
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production" and v == "dev_local":
            raise ValueError("OTP_MODE 'dev_local' is NOT allowed in production environment")
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
