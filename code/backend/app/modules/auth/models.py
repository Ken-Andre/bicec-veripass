import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    DateTime,
    ForeignKey,
    Text,
    Enum,
)
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class AgentRole(str, PyEnum):
    """
    Rôles fonctionnels des agents back-office.

    IMPORTANT — Terminologie :
    Ces valeurs (JEAN, THOMAS, SYLVIE, ADMIN_IT) sont des IDENTIFIANTS DE RÔLE
    fonctionnel, pas des noms de personnes. Ils correspondent aux personas UX
    définis dans l'architecture (§ADR-009, §7.3) :

        JEAN      → Rôle : Agent KYC Validateur
                    Persona demo : "Jean Dupont" (jean@bicec.cm)
                    Responsabilité : validation dossiers, queue, approve/reject

        THOMAS    → Rôle : Superviseur AML/CFT & Admin Agences
                    Persona demo : "Thomas Martin" (thomas@bicec.cm)
                    Responsabilité : screening PEP/Sanctions, batch Amplitude

        SYLVIE    → Rôle : Directrice Opérations / Command Center
                    Persona demo : "Sylvie Bernard" (sylvie@bicec.cm)
                    Responsabilité : dashboard SLA, funnel analytics, escalades

        ADMIN_IT  → Rôle : Administrateur Système
                    Persona demo : "Admin IT" (admin@bicec.cm)
                    Responsabilité : gestion agents, agences, config système
                    NOTE : ADMIN_IT n'a PAS de ligne dans la table `agents`
                           (il ne traite pas de dossiers KYC)

    En production, un vrai agent nommé "Kouam Bertrand" avec le rôle JEAN
    aura role=JEAN dans la DB — son prénom n'est pas "Jean".
    Les comptes demo (jean@bicec.cm etc.) sont des fixtures de développement
    créées par seed_data.py, pas des comptes de production.
    """

    JEAN = "JEAN"
    THOMAS = "THOMAS"
    SYLVIE = "SYLVIE"
    ADMIN_IT = "ADMIN_IT"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(20), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    pin_hash = Column(String(255), nullable=True)
    biometric_opt_in = Column(Boolean, default=False)
    language = Column(String(10), default="fr")
    role = Column(
        String(20), nullable=False, default="CLIENT"
    )  # CLIENT, JEAN, THOMAS, SYLVIE, ADMIN_IT

    liveness_lockout_count_24h = Column(Integer, default=0)
    last_lockout_reset_at = Column(DateTime(timezone=True), nullable=True)

    # Soft delete support - retained for GDPR compliance (10 years)
    # Authentication is BLOCKED for deleted users, but data is preserved
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    kyc_sessions = relationship(
        "KYCSession", back_populates="user", cascade="all, delete-orphan"
    )
    notifications = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )


class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agency_id = Column(UUID(as_uuid=True), ForeignKey("agencies.id"), nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(
        Enum(AgentRole, name="agent_role"), nullable=False
    )  # JEAN, THOMAS, SYLVIE, ADMIN_IT
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
    # code_hash stores bcrypt hash of the OTP; hash_algo records the algorithm for auditability
    code_hash = Column(Text, nullable=False)
    hash_algo = Column(String(20), nullable=False, default="bcrypt")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0)
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    request_ip = Column(INET, nullable=True)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class TokenRevocation(Base):
    """Revocation list for refresh tokens (jti-based). Enables immediate invalidation."""

    __tablename__ = "token_revocations"

    jti = Column(UUID(as_uuid=True), primary_key=True)
    revoked_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
