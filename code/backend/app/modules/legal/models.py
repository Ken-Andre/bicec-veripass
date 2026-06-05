"""Versioned legal document models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class LegalDocumentVersion(Base):
    """Published or draft legal content shown to users before consent."""

    __tablename__ = "legal_document_versions"
    __table_args__ = (
        UniqueConstraint(
            "document_key",
            "locale",
            "version",
            name="uq_legal_document_versions_key_locale_version",
        ),
        Index(
            "ix_legal_document_versions_lookup",
            "document_key",
            "locale",
            "status",
            "effective_at",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_key = Column(String(64), nullable=False)
    locale = Column(String(10), nullable=False, default="fr")
    version = Column(String(32), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    content_format = Column(String(16), nullable=False, default="markdown")
    content_hash = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False, default="DRAFT")
    effective_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    published_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    publisher = relationship("Agent", foreign_keys=[published_by])
    creator = relationship("Agent", foreign_keys=[created_by])
    updater = relationship("Agent", foreign_keys=[updated_by])
