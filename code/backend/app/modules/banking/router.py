"""Banking module routes."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.banking import service
from app.modules.banking.schemas import (
    CardResponse,
    CardFreezeRequest,
    TransferSendRequest,
    TransferSendResponse,
    TransferResponse,
    TransferIsoPreview,
    TransactionResponse,
    TransactionListResponse,
    SavingsPocketCreate,
    SavingsPocketUpdate,
    SavingsPocketResponse,
    SavingsSummaryResponse,
)

router = APIRouter()


# ── Cards ──

@router.get("/cards", response_model=list[CardResponse])
async def list_cards(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's bank cards."""
    cards = await service.list_cards(db, current_user.id)
    return [CardResponse(
        id=c.id,
        name=f"{'Virtuelle' if c.card_type == 'virtual' else 'Physique'}",
        last4=c.last4,
        card_type=c.card_type,
        brand=c.brand,
        expiry=c.expiry,
        status=c.status,
        frozen=c.frozen,
        created_at=c.created_at,
    ) for c in cards]


@router.post("/cards/{card_id}/freeze", response_model=CardResponse)
async def freeze_card(
    card_id: UUID,
    body: CardFreezeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Freeze or unfreeze a card."""
    card = await service.toggle_card_freeze(db, card_id, current_user.id, body.frozen)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return CardResponse(
        id=card.id,
        name=f"{'Virtuelle' if card.card_type == 'virtual' else 'Physique'}",
        last4=card.last4,
        card_type=card.card_type,
        brand=card.brand,
        expiry=card.expiry,
        status=card.status,
        frozen=card.frozen,
        created_at=card.created_at,
    )


# ── Transfers ──

@router.post("/transfers/send", response_model=TransferSendResponse, status_code=status.HTTP_201_CREATED)
async def send_transfer(
    body: TransferSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a bank or mobile transfer with ISO 20022 generation."""
    transfer = await service.create_transfer(
        db,
        current_user.id,
        transfer_type=body.transfer_type,
        amount=body.amount,
        currency=body.currency,
        creditor_name=body.creditor_name,
        creditor_iban=body.creditor_iban,
        creditor_bic=body.creditor_bic,
        creditor_phone=body.creditor_phone,
        motif=body.motif,
    )

    return TransferSendResponse(
        transfer=TransferResponse(
            id=transfer.id,
            transfer_type=transfer.transfer_type,
            amount=float(transfer.amount),
            currency=transfer.currency,
            creditor_name=transfer.creditor_name,
            creditor_iban=transfer.creditor_iban,
            creditor_phone=transfer.creditor_phone,
            motif=transfer.motif,
            status=transfer.status,
            iso_msg_id=transfer.iso_msg_id,
            iso_end_to_end_id=transfer.iso_end_to_end_id,
            iso_scheme=transfer.iso_scheme,
            created_at=transfer.created_at,
            completed_at=transfer.completed_at,
        ),
        iso_preview=TransferIsoPreview(
            msg_id=transfer.iso_msg_id or "",
            end_to_end_id=transfer.iso_end_to_end_id or "",
            instr_id=transfer.iso_instr_id or "",
            scheme=transfer.iso_scheme or "",
            xml=transfer.iso_xml or "",
            created_at=transfer.created_at.isoformat(),
        ),
    )


@router.get("/transfers", response_model=list[TransferResponse])
async def list_transfers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's transfers."""
    transfers = await service.list_transfers(db, current_user.id)
    return [TransferResponse(
        id=t.id,
        transfer_type=t.transfer_type,
        amount=float(t.amount),
        currency=t.currency,
        creditor_name=t.creditor_name,
        creditor_iban=t.creditor_iban,
        creditor_phone=t.creditor_phone,
        motif=t.motif,
        status=t.status,
        iso_msg_id=t.iso_msg_id,
        iso_end_to_end_id=t.iso_end_to_end_id,
        iso_scheme=t.iso_scheme,
        created_at=t.created_at,
        completed_at=t.completed_at,
    ) for t in transfers]


# ── Transactions ──

@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    category: str | None = Query(None, pattern="^(all|in|out)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's transactions with optional category filter."""
    cat = None if category in (None, "all") else category
    txs, total = await service.list_transactions(db, current_user.id, category=cat, page=page, page_size=page_size)
    return TransactionListResponse(
        transactions=[TransactionResponse(
            id=tx.id,
            tx_type=tx.tx_type,
            label=tx.label,
            amount=float(tx.amount),
            category=tx.category,
            counterparty=tx.counterparty,
            iso_meta=tx.iso_meta,
            created_at=tx.created_at,
        ) for tx in txs],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── Savings Pockets ──

@router.get("/savings/pockets", response_model=SavingsSummaryResponse)
async def list_savings_pockets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's savings pockets with total."""
    pockets = await service.list_savings_pockets(db, current_user.id)
    total = sum(float(p.amount) for p in pockets)
    return SavingsSummaryResponse(
        total_saved=total,
        pockets=[SavingsPocketResponse(
            id=p.id,
            name=p.name,
            amount=float(p.amount),
            goal=float(p.goal),
            color=p.color,
            icon=p.icon,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ) for p in pockets],
    )


@router.post("/savings/pockets", response_model=SavingsPocketResponse, status_code=status.HTTP_201_CREATED)
async def create_savings_pocket(
    body: SavingsPocketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new savings pocket."""
    pocket = await service.create_savings_pocket(
        db, current_user.id,
        name=body.name,
        goal=body.goal,
        initial_amount=body.initial_amount,
        color=body.color,
        icon=body.icon,
    )
    return SavingsPocketResponse(
        id=pocket.id,
        name=pocket.name,
        amount=float(pocket.amount),
        goal=float(pocket.goal),
        color=pocket.color,
        icon=pocket.icon,
        created_at=pocket.created_at,
        updated_at=pocket.updated_at,
    )


@router.put("/savings/pockets/{pocket_id}", response_model=SavingsPocketResponse)
async def update_savings_pocket(
    pocket_id: UUID,
    body: SavingsPocketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a savings pocket."""
    pocket = await service.update_savings_pocket(
        db, pocket_id, current_user.id,
        name=body.name, goal=body.goal, color=body.color, icon=body.icon,
    )
    if not pocket:
        raise HTTPException(status_code=404, detail="Pocket not found")
    return SavingsPocketResponse(
        id=pocket.id,
        name=pocket.name,
        amount=float(pocket.amount),
        goal=float(pocket.goal),
        color=pocket.color,
        icon=pocket.icon,
        created_at=pocket.created_at,
        updated_at=pocket.updated_at,
    )
