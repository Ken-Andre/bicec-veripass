"""Pydantic schemas for banking module."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID


# ── Card schemas ──

class CardResponse(BaseModel):
    id: UUID
    name: str
    last4: str
    card_type: str
    brand: str
    expiry: str
    status: str
    frozen: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CardFreezeRequest(BaseModel):
    frozen: bool


# ── Transfer schemas ──

class TransferSendRequest(BaseModel):
    transfer_type: str = Field(..., pattern="^(bicec|mobile)$")
    amount: float = Field(..., gt=0)
    currency: str = Field(default="XAF", max_length=3)
    creditor_name: str = Field(..., min_length=1, max_length=200)
    creditor_iban: Optional[str] = Field(None, max_length=34)
    creditor_bic: Optional[str] = Field(None, max_length=11)
    creditor_phone: Optional[str] = Field(None, max_length=20)
    motif: Optional[str] = Field(None, max_length=140)


class TransferResponse(BaseModel):
    id: UUID
    transfer_type: str
    amount: float
    currency: str
    creditor_name: str
    creditor_iban: Optional[str]
    creditor_phone: Optional[str]
    motif: Optional[str]
    status: str
    iso_msg_id: Optional[str]
    iso_end_to_end_id: Optional[str]
    iso_scheme: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class TransferIsoPreview(BaseModel):
    msg_id: str
    end_to_end_id: str
    instr_id: str
    scheme: str
    xml: str
    created_at: str


class TransferSendResponse(BaseModel):
    transfer: TransferResponse
    iso_preview: TransferIsoPreview


# ── Transaction schemas ──

class TransactionResponse(BaseModel):
    id: UUID
    tx_type: str
    label: str
    amount: float
    category: str
    counterparty: Optional[str]
    iso_meta: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    transactions: List[TransactionResponse]
    total: int
    page: int
    page_size: int


# ── Savings schemas ──

class SavingsPocketCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    goal: float = Field(..., gt=0)
    initial_amount: float = Field(default=0, ge=0)
    color: Optional[str] = None
    icon: Optional[str] = None


class SavingsPocketUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    goal: Optional[float] = Field(None, gt=0)
    color: Optional[str] = None
    icon: Optional[str] = None


class SavingsPocketResponse(BaseModel):
    id: UUID
    name: str
    amount: float
    goal: float
    color: Optional[str]
    icon: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SavingsSummaryResponse(BaseModel):
    total_saved: float
    pockets: List[SavingsPocketResponse]


# ── Account schemas ──

class AccountInfoResponse(BaseModel):
    user_id: UUID
    iban: str
    bic: str
    holder_name: str
    balance: float
    currency: str
    access_level: str
