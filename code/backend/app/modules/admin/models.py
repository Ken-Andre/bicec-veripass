import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.base_class import Base

class Agency(Base):
    __tablename__ = "agencies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, index=True, nullable=False)
    location = Column(Text, nullable=True)

    # Relationships
    agents = relationship("Agent", back_populates="agency")
    kyc_sessions = relationship("KYCSession", back_populates="agency")

class ProvisioningBatch(Base):
    __tablename__ = "provisioning_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(String(50), default="PENDING") # PENDING, PROCESSING, COMPLETED, FAILED
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    total_items = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)

    # Relationships
    items = relationship("ProvisioningBatchItem", back_populates="batch", cascade="all, delete-orphan")

class ProvisioningBatchItem(Base):
    __tablename__ = "provisioning_batch_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("provisioning_batches.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    
    status = Column(String(50), default="PENDING") # PENDING, SUCCESS, ERROR
    error_message = Column(Text, nullable=True)
    
    axway_request_id = Column(String(100), nullable=True)
    iso20022_message_ref = Column(String(100), nullable=True)
    
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    batch = relationship("ProvisioningBatch", back_populates="items")
    kyc_session = relationship("KYCSession", back_populates="provisioning_items")
