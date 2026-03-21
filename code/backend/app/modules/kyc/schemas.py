"""Module Pydantic schemas."""
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class KYCSessionResponse(BaseModel):
    model_config = {"from_attributes": True}
    
    id: str
    status: str
    last_step_completed: Optional[str] = None
    started_at: datetime
    user_id: str
