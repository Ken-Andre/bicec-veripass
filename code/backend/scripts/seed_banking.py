"""Seed banking data for development and testing.

Usage:
    python -m scripts.seed_banking
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.modules.auth.models import User
from app.modules.banking.models import BankCard, Transaction, SavingsPocket


async def seed_banking_data(db: AsyncSession) -> None:
    """Create sample banking data for existing test users."""
    # Find first non-deleted user
    result = await db.execute(
        select(User).where(User.is_deleted == False).limit(1)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user:
        print("[seed_banking] No users found, skipping.")
        return

    user_id = user.id
    print(f"[seed_banking] Seeding data for user {user_id}")

    # ── Cards ──
    existing_cards = await db.execute(
        select(BankCard).where(BankCard.user_id == user_id).limit(1)
    )
    if not existing_cards.scalar_one_or_none():
        cards = [
            BankCard(
                id=uuid.uuid4(),
                user_id=user_id,
                card_number_encrypted="4532890123454521",
                last4="4521",
                card_type="virtual",
                brand="visa",
                expiry="12/27",
                cvv_encrypted="456",
                status="active",
                frozen=False,
            ),
            BankCard(
                id=uuid.uuid4(),
                user_id=user_id,
                card_number_encrypted="4716230056788903",
                last4="8903",
                card_type="physical",
                brand="visa",
                expiry="09/28",
                cvv_encrypted="789",
                status="active",
                frozen=False,
            ),
        ]
        db.add_all(cards)
        print(f"[seed_banking] Created {len(cards)} cards")

    # ── Transactions ──
    existing_txs = await db.execute(
        select(Transaction).where(Transaction.user_id == user_id).limit(1)
    )
    if not existing_txs.scalar_one_or_none():
        now = datetime.now(timezone.utc)
        day = timedelta(days=1)
        transactions = [
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="credit", label="Salaire Décembre", amount=Decimal("250000"), category="salary", counterparty="SABC", created_at=now - 2 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Recharge MTN", amount=Decimal("-5000"), category="mobile_recharge", counterparty="MTN MoMo", created_at=now - 2 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Paiement ENEO", amount=Decimal("-15000"), category="bill_payment", counterparty="ENEO Cameroun", created_at=now - 3 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Supermarché Mahima", amount=Decimal("-23500"), category="purchase", counterparty="Mahima Supermarket", created_at=now - 4 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Virement à Paul", amount=Decimal("-30000"), category="transfer_out", counterparty="NGUEMO Paul", created_at=now - 5 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="credit", label="Remboursement", amount=Decimal("10000"), category="transfer_in", counterparty="FOTSO Jean", created_at=now - 5 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Recharge Orange", amount=Decimal("-3000"), category="mobile_recharge", counterparty="Orange Money", created_at=now - 6 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Paiement CAMWATER", amount=Decimal("-8000"), category="bill_payment", counterparty="CAMWATER", created_at=now - 7 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="credit", label="Virement reçu", amount=Decimal("45000"), category="transfer_in", counterparty="KAMGA Alain", created_at=now - 8 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Restaurant Le Marrakech", amount=Decimal("-7500"), category="purchase", counterparty="Le Marrakech", created_at=now - 9 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Virement Mobile Money", amount=Decimal("-20000"), category="transfer_out", counterparty="TCHAMDA Anne", created_at=now - 10 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="credit", label="Prime de fin d'année", amount=Decimal("100000"), category="salary", counterparty="SABC", created_at=now - 12 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Pharmacie du Centre", amount=Decimal("-4500"), category="purchase", counterparty="Pharmacie Centre", created_at=now - 13 * day),
            Transaction(id=uuid.uuid4(), user_id=user_id, tx_type="debit", label="Abonnement Canal+", amount=Decimal("-10000"), category="bill_payment", counterparty="Canal+ Cameroun", created_at=now - 14 * day),
        ]
        db.add_all(transactions)
        print(f"[seed_banking] Created {len(transactions)} transactions")

    # ── Savings Pockets ──
    existing_pockets = await db.execute(
        select(SavingsPocket).where(SavingsPocket.user_id == user_id).limit(1)
    )
    if not existing_pockets.scalar_one_or_none():
        pockets = [
            SavingsPocket(id=uuid.uuid4(), user_id=user_id, name="Épargne voyage", amount=Decimal("50000"), goal=Decimal("200000"), color="bg-amber-500", icon="✈️"),
            SavingsPocket(id=uuid.uuid4(), user_id=user_id, name="Fonds d'urgence", amount=Decimal("75000"), goal=Decimal("500000"), color="bg-emerald-500", icon="🛟"),
            SavingsPocket(id=uuid.uuid4(), user_id=user_id, name="Études", amount=Decimal("120000"), goal=Decimal("300000"), color="bg-blue-500", icon="📚"),
        ]
        db.add_all(pockets)
        print(f"[seed_banking] Created {len(pockets)} savings pockets")

    await db.commit()
    print("[seed_banking] Done.")


async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed_banking_data(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
