"""Module SQLAlchemy models — AML/CFT.
NOTE: Master models for Agencies and AML Alerts are in 'admin' and 'kyc' modules.
This file only contains AML-specific extensions if needed.
"""

from __future__ import annotations
from uuid import uuid4
from sqlalchemy import Column, Text, TIMESTAMP, ForeignKey, func, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from app.db.base_class import Base


# We keep BatchJob here but rename the table to be module-specific
class BatchJob(Base):
    """Jobs de provisionnement Amplitude (Module AML specific version)."""

    __tablename__ = "aml_process_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    job_type = Column(Text, nullable=False, server_default="AMPLITUDE_PROVISIONING")
    status = Column(Text, nullable=False, server_default="PENDING")
    total_items = Column(Integer, nullable=False, server_default="0")
    processed_items = Column(Integer, nullable=False, server_default="0")
    failed_items = Column(Integer, nullable=False, server_default="0")
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class AmlListImport(Base):
    """Audited AML list import run for internal BICEC CSV sources."""

    __tablename__ = "aml_list_imports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    source = Column(Text, nullable=False)
    list_type = Column(Text, nullable=False)
    filename = Column(Text, nullable=True)
    status = Column(Text, nullable=False, server_default="DRY_RUN")
    total_rows = Column(Integer, nullable=False, server_default="0")
    imported_rows = Column(Integer, nullable=False, server_default="0")
    failed_rows = Column(Integer, nullable=False, server_default="0")
    error_report = Column(JSONB, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
