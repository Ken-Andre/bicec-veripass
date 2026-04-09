"""Module Pydantic schemas Audit."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ActionType(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    REQUEST_INFO = "REQUEST_INFO"
    ASSIGN = "ASSIGN"
    UNASSIGN = "UNASSIGN"
    OCR_CORRECT = "OCR_CORRECT"
    AML_CLEAR = "AML_CLEAR"
    AML_CONFIRM = "AML_CONFIRM"
    AML_ESCALATE = "AML_ESCALATE"
    FIELD_EDIT = "FIELD_EDIT"
    STATUS_CHANGE = "STATUS_CHANGE"
    SYSTEM_AUTO = "SYSTEM_AUTO"
    BIOMETRIC_CHECK = "BIOMETRIC_CHECK"
    MERGE_IDENTITY = "MERGE_IDENTITY"


class AuditEntryResponse(BaseModel):
    id: str
    timestamp: Optional[datetime] = None
    agent_id: str = Field(alias="agentId")
    agent_name: str = Field(alias="agentName")
    action_type: ActionType = Field(alias="actionType")
    previous_state: Optional[str] = Field(None, alias="previousState")
    new_state: Optional[str] = Field(None, alias="newState")
    rationale: Optional[str] = None
    session_id: Optional[str] = Field(None, alias="sessionId")
    metadata: Optional[dict] = None

    model_config = {"populate_by_name": True, "from_attributes": True}


class AuditFilterParams(BaseModel):
    session_id: Optional[str] = Field(None, alias="sessionId")
    agent_id: Optional[str] = Field(None, alias="agentId")
    action_type: Optional[ActionType] = Field(None, alias="actionType")
    date_from: Optional[datetime] = Field(None, alias="dateFrom")
    date_to: Optional[datetime] = Field(None, alias="dateTo")
    limit: int = Field(100, ge=1, le=1000)

    model_config = {"populate_by_name": True}
