import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text, Numeric
# from sqlalchemy import Table
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB, ARRAY, DATE
from sqlalchemy.orm import relationship

from app.db.base_class import Base

class KYCSession(Base):
    __tablename__ = "kyc_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    agency_id = Column(UUID(as_uuid=True), ForeignKey("agencies.id"), nullable=True)
    
    status = Column(String(50), nullable=False, default="DRAFT")
    access_level = Column(String(50), nullable=False, default="RESTRICTED")
    niu_type = Column(String(50), nullable=True) # DECLARATIVE, UPLOADED, MISSING
    
    confidence_score_global = Column(Numeric(5, 4), nullable=True)
    liveness_strike_count = Column(Integer, default=0)
    
    priority_flag = Column(Boolean, default=False)
    doc_expiry_flag = Column(Boolean, default=False)
    doc_expiry_deadline = Column(DateTime(timezone=True), nullable=True)
    doc_expiry_notified_at = Column(DateTime(timezone=True), nullable=True)
    
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    last_step_completed = Column(String(100), nullable=True)
    submission_ip = Column(INET, nullable=True)

    # Relationships
    user = relationship("User", back_populates="kyc_sessions")
    agency = relationship("Agency", back_populates="kyc_sessions")
    documents = relationship("Document", back_populates="kyc_session", cascade="all, delete-orphan")
    biometric_results = relationship("BiometricResult", back_populates="kyc_session", cascade="all, delete-orphan", uselist=False)
    aml_alerts = relationship("AMLAlert", back_populates="kyc_session", cascade="all, delete-orphan")
    duplicate_checks = relationship("DuplicateCheck", foreign_keys="[DuplicateCheck.session_id_new]", back_populates="session_new", cascade="all, delete-orphan")
    consent_record = relationship("ConsentRecord", back_populates="kyc_session", cascade="all, delete-orphan", uselist=False)
    assignments = relationship("DossierAssignment", back_populates="kyc_session", cascade="all, delete-orphan")
    decisions = relationship("ValidationDecision", back_populates="kyc_session", cascade="all, delete-orphan")
    provisioning_items = relationship("ProvisioningBatchItem", back_populates="kyc_session")
    support_threads = relationship("SupportThread", back_populates="kyc_session", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    
    doc_type = Column(String(50), nullable=False) # CNI_RECTO, CNI_VERSO, BILL_ENEO, SELFIE, NIU
    file_path = Column(Text, nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    
    ocr_engine = Column(String(50), nullable=True) # PADDLE, GLM, PADDLE_THEN_GLM
    ocr_raw_json = Column(JSONB, nullable=True)
    confidence_per_field = Column(JSONB, nullable=True)
    capture_quality_metrics = Column(JSONB, nullable=True) # {"laplacian": 145, "luminance_std": 0.32}
    
    captured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    file_size_bytes = Column(Integer, nullable=True)

    # Relationships
    kyc_session = relationship("KYCSession", back_populates="documents")
    ocr_fields = relationship("OCRField", back_populates="document", cascade="all, delete-orphan")

class OCRField(Base):
    __tablename__ = "ocr_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    
    field_name = Column(Text, nullable=False)
    extracted_value = Column(Text, nullable=True)
    confidence_score = Column(Numeric(5, 4), nullable=False)
    
    human_corrected = Column(Boolean, default=False)
    corrected_value = Column(Text, nullable=True)
    corrected_by_agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    corrected_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    document = relationship("Document", back_populates="ocr_fields")

class BiometricResult(Base):
    __tablename__ = "biometric_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    
    face_match_score = Column(Numeric(5, 4), nullable=True)
    liveness_score = Column(Numeric(5, 4), nullable=True)
    anti_spoofing_score = Column(Numeric(5, 4), nullable=True)
    
    model_version_face = Column(String(50), nullable=True)
    model_version_liveness = Column(String(50), nullable=True)
    
    processed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    kyc_session = relationship("KYCSession", back_populates="biometric_results")

class ValidationDecision(Base):
    __tablename__ = "validation_decisions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    
    decision = Column(String(50), nullable=False) # APPROVED, REJECTED, INFO_REQUESTED
    reason = Column(Text, nullable=True)
    
    agent_ip = Column(INET, nullable=True)
    decided_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    kyc_session = relationship("KYCSession", back_populates="decisions")
    agent = relationship("Agent", back_populates="decisions")

class DossierAssignment(Base):
    __tablename__ = "dossier_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_current = Column(Boolean, default=True)

    # Relationships
    kyc_session = relationship("KYCSession", back_populates="assignments")
    agent = relationship("Agent", back_populates="assignments")

class AMLAlert(Base):
    __tablename__ = "aml_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    pep_sanctions_id = Column(UUID(as_uuid=True), ForeignKey("pep_sanctions.id"), nullable=True)
    
    alert_type = Column(String(50), nullable=False) # PEP, SANCTIONS_UN, SANCTIONS_EU, SANCTIONS_OFAC
    match_score = Column(Numeric(5, 4), nullable=False)
    status = Column(String(50), nullable=False, default="OPEN") # OPEN, CLEARED, CONFIRMED, ESCALATED
    
    cleared_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    justification = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    kyc_session = relationship("KYCSession", back_populates="aml_alerts")
    pep_sanctions = relationship("PEPSanctions", back_populates="alerts")

class PEPSanctions(Base):
    __tablename__ = "pep_sanctions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False) # INDIVIDUAL, ENTITY
    full_name = Column(Text, nullable=False, index=True)
    aliases = Column(ARRAY(Text), nullable=True)
    date_of_birth = Column(DATE, nullable=True)
    nationality = Column(String(100), nullable=True)
    programs = Column(ARRAY(Text), nullable=True)
    is_active = Column(Boolean, default=True)
    last_synced_at = Column(DATE, default=lambda: datetime.now(timezone.utc).date())

    # Relationships
    alerts = relationship("AMLAlert", back_populates="pep_sanctions")

class DuplicateCheck(Base):
    __tablename__ = "duplicate_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id_new = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    session_id_existing = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    
    match_type = Column(String(50), nullable=False)
    resolution = Column(String(50), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    session_new = relationship("KYCSession", foreign_keys=[session_id_new], back_populates="duplicate_checks")

class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    
    cgu_accepted = Column(Boolean, default=False)
    privacy_accepted = Column(Boolean, default=False)
    data_processing_accepted = Column(Boolean, default=False)
    
    consent_method = Column(String(50), nullable=False) # CHECKBOX_DIGITAL, PAPER_SCAN
    cgu_version = Column(String(20), default="1.0.0")
    privacy_version = Column(String(20), default="1.0.0")
    consent_metadata = Column(JSONB, nullable=True)
    
    signed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    client_ip = Column(INET, nullable=True)

    # Relationships
    kyc_session = relationship("KYCSession", back_populates="consent_record")

class SupportThread(Base):
    __tablename__ = "support_threads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), default="OPEN")

    # Relationships
    kyc_session = relationship("KYCSession", back_populates="support_threads")
    messages = relationship("SupportMessage", back_populates="thread", cascade="all, delete-orphan")

class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(UUID(as_uuid=True), ForeignKey("support_threads.id"), nullable=False)
    
    sender_type = Column(String(20), nullable=False) # MARIE, JEAN
    sender_id = Column(UUID(as_uuid=True), nullable=False) # user_id or agent_id
    
    content = Column(Text, nullable=False)
    attachment_path = Column(Text, nullable=True)
    attachment_sha256 = Column(String(64), nullable=True)
    
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    thread = relationship("SupportThread", back_populates="messages")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    type = Column(String(50), nullable=False)
    message = Column(Text, nullable=True)
    payload = Column(JSONB, nullable=True)
    
    is_read = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
