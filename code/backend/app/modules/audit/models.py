import uuid
from sqlalchemy import Column, String, Text, DateTime, JSONB, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.base_class import Base

class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = {"schema": "audit"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action = Column(String(100), nullable=False) # LOGIN, KYC_SUBMIT, DOCUMENT_UPLOAD, DECISION_GENERATE, etc.
    
    table_name = Column(String(100), nullable=True)
    record_id = Column(String(100), nullable=True)
    
    old_data = Column(JSONB, nullable=True)
    new_data = Column(JSONB, nullable=True)
    
    performed_by = Column(UUID(as_uuid=True), index=True, nullable=True) # user_id or agent_id
    performed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    
    client_ip = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    request_id = Column(UUID(as_uuid=True), nullable=True)
