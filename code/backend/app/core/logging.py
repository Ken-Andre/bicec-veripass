import logging
import sys
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from logging.handlers import RotatingFileHandler

from pythonjsonlogger import jsonlogger

class CorrelationFilter(logging.Filter):
    def filter(self, record):
        if not hasattr(record, "correlation_id"):
            record.correlation_id = "N/A"
        return True

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        if not log_record.get("timestamp"):
            now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            log_record["timestamp"] = now
        if log_record.get("level"):
            log_record["level"] = log_record["level"].upper()
        else:
            log_record["level"] = record.levelname

        # Sensitive data masking
        sensitive_keys = ["otp_code", "pin", "jwt_token", "password", "secret"]
        for key in sensitive_keys:
            if key in log_record:
                log_record[key] = "***"

def setup_logging(log_to_file: bool = True, log_dir: str = "logs", log_level: str = "INFO"):
    """
    Setup logging with configurable file output.
    Guards against filesystem permission errors.
    """
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    correlation_filter = CorrelationFilter()
    logger.addFilter(correlation_filter)
    
    formatter = CustomJsonFormatter(
        "%(timestamp)s %(level)s %(name)s %(msg)s %(correlation_id)s %(service)s",
        rename_fields={"name": "logger"}
    )
    
    # Console Handler (always enabled)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # Clear existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logger.addHandler(console_handler)
    
    # File Handler (optional, with error guard)
    if log_to_file:
        try:
            os.makedirs(log_dir, exist_ok=True)
            file_handler = RotatingFileHandler(
                os.path.join(log_dir, "app.log"),
                maxBytes=50 * 1024 * 1024,
                backupCount=5
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
        except (OSError, PermissionError) as e:
            # Log to console only if file handler fails
            logger.warning(f"Could not create log file handler: {e}. Logging to console only.")
    
    extra = {"service": "bicec-veripass-api"}
    return logging.LoggerAdapter(logger, extra)

# Lazy initialization - logger is created on first use
_logger_instance: Optional[logging.LoggerAdapter] = None

def get_logger() -> logging.LoggerAdapter:
    """Get or create logger instance lazily."""
    global _logger_instance
    if _logger_instance is None:
        log_to_file = os.environ.get("LOG_TO_FILE", "true").lower() == "true"
        log_dir = os.environ.get("LOG_DIR", "logs")
        log_level = os.environ.get("LOG_LEVEL", "INFO")
        _logger_instance = setup_logging(log_to_file, log_dir, log_level)
    return _logger_instance

# Module-level logger property that initializes on first access
class _LoggerProxy:
    """Proxy that lazily initializes the logger on first attribute access."""
    def __getattr__(self, name: str):
        return getattr(get_logger(), name)

logger = _LoggerProxy()