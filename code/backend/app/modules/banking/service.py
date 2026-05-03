"""Banking service layer."""

from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.banking.models import BankCard, Transfer, Transaction, SavingsPocket
from app.modules.kyc.models import KYCSession
from app.services.iso20022_service import build_pacs_008


def _derive_iban(user_id: UUID) -> str:
    """Derive a stable IBAN from user_id (no Account table yet)."""
    uid_int = int(user_id)
    account_number = str(uid_int % 10**11).zfill(11)
    return f"CM211000100023{account_number}2"


# ── Cards ──

async def list_cards(db: AsyncSession, user_id: UUID) -> list[BankCard]:
    result = await db.execute(
        select(BankCard).where(BankCard.user_id == user_id).order_by(BankCard.created_at)
    )
    return list(result.scalars().all())


async def toggle_card_freeze(db: AsyncSession, card_id: UUID, user_id: UUID, frozen: bool) -> BankCard | None:
    result = await db.execute(
        select(BankCard).where(BankCard.id == card_id, BankCard.user_id == user_id)
    )
    card = result.scalar_one_or_none()
    if not card:
        return None
    card.frozen = frozen
    card.status = "frozen" if frozen else "active"
    card.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(card)
    return card


# ── Transfers ──

async def create_transfer(
    db: AsyncSession,
    user_id: UUID,
    *,
    transfer_type: str,
    amount: float,
    currency: str,
    creditor_name: str,
    creditor_iban: str | None = None,
    creditor_bic: str | None = None,
    creditor_phone: str | None = None,
    motif: str | None = None,
) -> Transfer:
    # Build ISO 20022 preview
    scheme = "XAF-RTGS" if transfer_type == "bicec" else "MOBILE"
    iban = creditor_iban or f"CM00MOBILE{(creditor_phone or '').replace(' ', '').zfill(20)}"[:34]

    iso = build_pacs_008(
        debtor_name="BICEC VeriPass User",
        debtor_iban="CM2110001000231234567890142",
        debtor_bic="BICECMCX",
        creditor_name=creditor_name,
        creditor_iban=iban,
        creditor_bic=creditor_bic,
        amount=amount,
        currency=currency,
        remittance=motif,
        scheme=scheme,
    )

    transfer = Transfer(
        user_id=user_id,
        transfer_type=transfer_type,
        amount=Decimal(str(amount)),
        currency=currency,
        creditor_name=creditor_name,
        creditor_iban=creditor_iban,
        creditor_bic=creditor_bic,
        creditor_phone=creditor_phone,
        motif=motif,
        status="completed",  # Mock: immediately completed
        iso_msg_id=iso["msg_id"],
        iso_end_to_end_id=iso["end_to_end_id"],
        iso_instr_id=iso["instr_id"],
        iso_scheme=iso["scheme"],
        iso_xml=iso["xml"],
        completed_at=datetime.now(timezone.utc),
    )
    db.add(transfer)

    # Create corresponding transaction
    tx = Transaction(
        user_id=user_id,
        tx_type="debit",
        label=f"Virement à {creditor_name}",
        amount=Decimal(str(-amount)),
        category="transfer_out",
        counterparty=creditor_name,
        iso_meta={
            "endToEndId": iso["end_to_end_id"],
            "msgId": iso["msg_id"],
            "scheme": iso["scheme"],
        },
    )
    db.add(tx)

    await db.commit()
    await db.refresh(transfer)
    return transfer


async def list_transfers(db: AsyncSession, user_id: UUID) -> list[Transfer]:
    result = await db.execute(
        select(Transfer).where(Transfer.user_id == user_id).order_by(Transfer.created_at.desc())
    )
    return list(result.scalars().all())


# ── Transactions ──

async def list_transactions(
    db: AsyncSession, user_id: UUID, *, category: str | None = None, page: int = 1, page_size: int = 20
) -> tuple[list[Transaction], int]:
    query = select(Transaction).where(Transaction.user_id == user_id)
    count_query = select(func.count(Transaction.id)).where(Transaction.user_id == user_id)

    if category:
        if category == "in":
            query = query.where(Transaction.amount > 0)
            count_query = count_query.where(Transaction.amount > 0)
        elif category == "out":
            query = query.where(Transaction.amount < 0)
            count_query = count_query.where(Transaction.amount < 0)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Transaction.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total


# ── Savings Pockets ──

async def list_savings_pockets(db: AsyncSession, user_id: UUID) -> list[SavingsPocket]:
    result = await db.execute(
        select(SavingsPocket).where(SavingsPocket.user_id == user_id).order_by(SavingsPocket.created_at)
    )
    return list(result.scalars().all())


async def create_savings_pocket(
    db: AsyncSession, user_id: UUID, *, name: str, goal: float, initial_amount: float = 0, color: str | None = None, icon: str | None = None
) -> SavingsPocket:
    pocket = SavingsPocket(
        user_id=user_id,
        name=name,
        amount=Decimal(str(initial_amount)),
        goal=Decimal(str(goal)),
        color=color,
        icon=icon,
    )
    db.add(pocket)
    await db.commit()
    await db.refresh(pocket)
    return pocket


async def update_savings_pocket(
    db: AsyncSession, pocket_id: UUID, user_id: UUID, *, name: str | None = None, goal: float | None = None, color: str | None = None, icon: str | None = None
) -> SavingsPocket | None:
    result = await db.execute(
        select(SavingsPocket).where(SavingsPocket.id == pocket_id, SavingsPocket.user_id == user_id)
    )
    pocket = result.scalar_one_or_none()
    if not pocket:
        return None
    if name is not None:
        pocket.name = name
    if goal is not None:
        pocket.goal = Decimal(str(goal))
    if color is not None:
        pocket.color = color
    if icon is not None:
        pocket.icon = icon
    pocket.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pocket)
    return pocket


# ── Account Info ──

async def get_account_info(db: AsyncSession, user_id: UUID) -> dict | None:
    """Return aggregated account info from KYC + transactions."""
    # Latest KYC session for holder name and access level
    kyc_result = await db.execute(
        select(KYCSession)
        .where(KYCSession.user_id == user_id)
        .order_by(KYCSession.started_at.desc())
        .limit(1)
    )
    kyc_session = kyc_result.scalar_one_or_none()

    # Balance = sum of all transaction amounts
    balance_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), Decimal("0")))
        .where(Transaction.user_id == user_id)
    )
    balance = float(balance_result.scalar() or 0)

    holder_name = kyc_session.client_name or "Client BICEC" if kyc_session else "Client BICEC"
    access_level = kyc_session.access_level or "RESTRICTED" if kyc_session else "RESTRICTED"

    return {
        "user_id": user_id,
        "iban": _derive_iban(user_id),
        "bic": "BICECMCX",
        "holder_name": holder_name,
        "balance": balance,
        "currency": "XAF",
        "access_level": access_level,
    }
