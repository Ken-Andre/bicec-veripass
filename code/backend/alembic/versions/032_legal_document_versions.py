"""032_legal_document_versions

Revision ID: 032_legal_document_versions
Revises: 031_business_metrics
Create Date: 2026-06-05
"""

from datetime import datetime, timezone
import hashlib
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "032_legal_document_versions"
down_revision: Union[str, Sequence[str], None] = "031_business_metrics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _seed_rows() -> list[dict]:
    now = datetime.now(timezone.utc)
    documents = [
        (
            "cgu",
            "fr",
            "Conditions Generales d'Utilisation",
            "Vous acceptez d'utiliser BICEC VeriPass pour initier et suivre votre parcours KYC. Les informations fournies doivent etre exactes et vous restez responsable de leur mise a jour.",
        ),
        (
            "cgu",
            "en",
            "Terms of Service",
            "You agree to use BICEC VeriPass to start and follow your KYC journey. The information provided must be accurate and you remain responsible for keeping it up to date.",
        ),
        (
            "privacy",
            "fr",
            "Politique de confidentialite",
            "BICEC traite vos donnees d'identification, de contact et de verification pour ouvrir, securiser et administrer votre relation bancaire, conformement aux obligations applicables.",
        ),
        (
            "privacy",
            "en",
            "Privacy Policy",
            "BICEC processes your identity, contact and verification data to open, secure and administer your banking relationship in line with applicable obligations.",
        ),
        (
            "data_processing",
            "fr",
            "Traitement des donnees personnelles",
            "Vous autorisez le traitement de vos donnees personnelles pour la verification KYC, la prevention de la fraude, les controles AML/CFT et la production des preuves d'audit.",
        ),
        (
            "data_processing",
            "en",
            "Personal Data Processing",
            "You authorize the processing of your personal data for KYC verification, fraud prevention, AML/CFT checks and audit evidence production.",
        ),
        (
            "biometric",
            "fr",
            "Consentement biometrique",
            "Vous acceptez que votre selfie et les signaux de vivacite soient traites afin de verifier que vous etes la personne presente pendant le parcours KYC.",
        ),
        (
            "biometric",
            "en",
            "Biometric Consent",
            "You agree that your selfie and liveness signals may be processed to verify that you are the person present during the KYC journey.",
        ),
    ]
    return [
        {
            "id": uuid.uuid4(),
            "document_key": key,
            "locale": locale,
            "version": "1.0.0",
            "title": title,
            "content": content,
            "content_format": "markdown",
            "content_hash": _hash(content),
            "status": "PUBLISHED",
            "effective_at": now,
            "published_at": now,
            "published_by": None,
            "created_by": None,
            "updated_by": None,
            "created_at": now,
            "updated_at": now,
        }
        for key, locale, title, content in documents
    ]


def upgrade() -> None:
    op.create_table(
        "legal_document_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_key", sa.String(length=64), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_format", sa.String(length=16), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("effective_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("published_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["agents.id"]),
        sa.ForeignKeyConstraint(["published_by"], ["agents.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "document_key",
            "locale",
            "version",
            name="uq_legal_document_versions_key_locale_version",
        ),
    )
    op.create_index(
        "ix_legal_document_versions_lookup",
        "legal_document_versions",
        ["document_key", "locale", "status", "effective_at"],
    )
    op.bulk_insert(sa.table(
        "legal_document_versions",
        sa.column("id"),
        sa.column("document_key"),
        sa.column("locale"),
        sa.column("version"),
        sa.column("title"),
        sa.column("content"),
        sa.column("content_format"),
        sa.column("content_hash"),
        sa.column("status"),
        sa.column("effective_at"),
        sa.column("published_at"),
        sa.column("published_by"),
        sa.column("created_by"),
        sa.column("updated_by"),
        sa.column("created_at"),
        sa.column("updated_at"),
    ), _seed_rows())


def downgrade() -> None:
    op.drop_index("ix_legal_document_versions_lookup", table_name="legal_document_versions")
    op.drop_table("legal_document_versions")
