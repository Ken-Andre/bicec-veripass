import uuid
from datetime import datetime, timezone


def get_now() -> datetime:
    return datetime.now(timezone.utc)

def format_phone(phone: str) -> str:
    # Basic formatting
    return phone.strip().replace(" ", "")

def generate_uuid() -> str:
    return str(uuid.uuid4())
