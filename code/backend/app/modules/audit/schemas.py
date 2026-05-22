"""Module Pydantic schemas Audit."""

from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class AuditEntryResponse(BaseModel):
    id: str
    timestamp: Optional[datetime] = None
    agent_id: str = Field(alias="agentId")
    agent_name: str = Field(alias="agentName")
    action_type: str = Field(alias="actionType")
    previous_state: Optional[str] = Field(None, alias="previousState")
    new_state: Optional[str] = Field(None, alias="newState")
    rationale: Optional[str] = None
    session_id: Optional[str] = Field(None, alias="sessionId")
    metadata: Optional[dict] = None

    model_config = {"populate_by_name": True, "from_attributes": True}


class AuditFilterParams(BaseModel):
    session_id: Optional[str] = Field(None, alias="sessionId")
    agent_id: Optional[str] = Field(None, alias="agentId")
    action_type: Optional[str] = Field(None, alias="actionType")
    date_from: Optional[datetime] = Field(None, alias="dateFrom")
    date_to: Optional[datetime] = Field(None, alias="dateTo")
    limit: int = Field(100, ge=1, le=1000)

    model_config = {"populate_by_name": True}
