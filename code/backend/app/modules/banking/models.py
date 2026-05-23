import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Numeric, Boolean, DateTime, ForeignKey, Text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class BankCard(Base):
    __tablename__ = "bank_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    card_number_encrypted = Column(String(255), nullable=False)
    last4 = Column(String(4), nullable=False)
    card_type = Column(String(20), nullable=False, default="virtual")  # virtual | physical
    brand = Column(String(20), nullable=False, default="visa")  # visa | mastercard
    expiry = Column(String(10), nullable=False)  # MM/YY
    cvv_encrypted = Column(String(255), nullable=False)

    status = Column(String(20), nullable=False, default="active")  # active | frozen | blocked
    frozen = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="bank_cards")


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    transfer_type = Column(String(20), nullable=False)  # bicec | mobile
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="XAF")

    creditor_name = Column(String(200), nullable=False)
    creditor_iban = Column(String(34), nullable=True)
    creditor_bic = Column(String(11), nullable=True)
    creditor_phone = Column(String(20), nullable=True)

    motif = Column(String(140), nullable=True)

    status = Column(String(20), nullable=False, default="pending")  # pending | completed | failed

    # ISO 20022 fields
    iso_msg_id = Column(String(100), nullable=True)
    iso_end_to_end_id = Column(String(100), nullable=True)
    iso_instr_id = Column(String(100), nullable=True)
    iso_scheme = Column(String(20), nullable=True)  # SEPA | XAF-RTGS | MOBILE
    iso_xml = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="transfers")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    tx_type = Column(String(10), nullable=False)  # credit | debit
    label = Column(String(200), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    category = Column(String(30), nullable=False)  # transfer_out | transfer_in | mobile_recharge | bill_payment | purchase | salary
    counterparty = Column(String(200), nullable=True)

    iso_meta = Column(JSONB, nullable=True)  # { endToEndId, msgId, scheme }

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="transactions")


class SavingsPocket(Base):
    __tablename__ = "savings_pockets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(100), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False, default=0)
    goal = Column(Numeric(15, 2), nullable=False)
    color = Column(String(50), nullable=True)
    icon = Column(String(10), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="savings_pockets")
