import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    pin_hash = Column(String(255), nullable=True)
    biometric_opt_in = Column(Boolean, default=False)
    language = Column(String(10), default="fr")
    role = Column(String(20), nullable=False, default="CLIENT") # CLIENT, JEAN, THOMAS, SYLVIE, ADMIN_IT
    
    liveness_lockout_count_24h = Column(Integer, default=0)
    last_lockout_reset_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    kyc_sessions = relationship("KYCSession", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agency_id = Column(UUID(as_uuid=True), ForeignKey("agencies.id"), nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), nullable=False) # JEAN, THOMAS, SYLVIE
    
    static_weight = Column(Integer, default=1)
    current_weight = Column(Integer, default=1)
    is_available = Column(Boolean, default=True)
    active_dossier_count = Column(Integer, default=0)
    
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    agency = relationship("Agency", back_populates="agents")
    assignments = relationship("DossierAssignment", back_populates="agent")
    decisions = relationship("ValidationDecision", back_populates="agent")

class OTPSession(Base):
    __tablename__ = "otp_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    code_hash = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0)
    is_used = Column(Boolean, default=False)
    request_ip = Column(INET, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
