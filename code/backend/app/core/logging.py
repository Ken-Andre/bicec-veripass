import logging
import sys
import json
from datetime import datetime, timezone
from typing import Any, Dict

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

import os
from logging.handlers import RotatingFileHandler

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Ensure logs directory exists
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    correlation_filter = CorrelationFilter()
    logger.addFilter(correlation_filter)
    
    formatter = CustomJsonFormatter(
        "%(timestamp)s %(level)s %(name)s %(msg)s %(correlation_id)s %(service)s",
        rename_fields={"name": "logger"}
    )
    
    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # File Handler (Rotation: 50MB, 5 backups)
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, "app.log"),
        maxBytes=50 * 1024 * 1024,
        backupCount=5
    )
    file_handler.setFormatter(formatter)
    
    # Clear existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    extra = {"service": "bicec-veripass-api"}
    return logging.LoggerAdapter(logger, extra)

# Initialize logger
logger = setup_logging()
