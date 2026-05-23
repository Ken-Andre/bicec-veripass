"""021_banking_tables

Revision ID: 021_banking
Revises: a1b2c3d4e5f6
Create Date: 2026-04-29 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "021_banking"
down_revision: Union[str, Sequence[str], None] = "020_add_client_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── bank_cards ──
    op.create_table(
        "bank_cards",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("card_number_encrypted", sa.String(length=255), nullable=False),
        sa.Column("last4", sa.String(length=4), nullable=False),
        sa.Column("card_type", sa.String(length=20), nullable=False, server_default=sa.text("'virtual'")),
        sa.Column("brand", sa.String(length=20), nullable=False, server_default=sa.text("'visa'")),
        sa.Column("expiry", sa.String(length=10), nullable=False),
        sa.Column("cvv_encrypted", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'active'")),
        sa.Column("frozen", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bank_cards_user_id", "bank_cards", ["user_id"], unique=False)

    # ── transfers ──
    op.create_table(
        "transfers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("transfer_type", sa.String(length=20), nullable=False),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default=sa.text("'XAF'")),
        sa.Column("creditor_name", sa.String(length=200), nullable=False),
        sa.Column("creditor_iban", sa.String(length=34), nullable=True),
        sa.Column("creditor_bic", sa.String(length=11), nullable=True),
        sa.Column("creditor_phone", sa.String(length=20), nullable=True),
        sa.Column("motif", sa.String(length=140), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("iso_msg_id", sa.String(length=100), nullable=True),
        sa.Column("iso_end_to_end_id", sa.String(length=100), nullable=True),
        sa.Column("iso_instr_id", sa.String(length=100), nullable=True),
        sa.Column("iso_scheme", sa.String(length=20), nullable=True),
        sa.Column("iso_xml", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transfers_user_id", "transfers", ["user_id"], unique=False)

    # ── transactions ──
    op.create_table(
        "transactions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tx_type", sa.String(length=10), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("counterparty", sa.String(length=200), nullable=True),
        sa.Column("iso_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"], unique=False)

    # ── savings_pockets ──
    op.create_table(
        "savings_pockets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False, server_default=sa.text("0")),
        sa.Column("goal", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("color", sa.String(length=50), nullable=True),
        sa.Column("icon", sa.String(length=10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_savings_pockets_user_id", "savings_pockets", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_savings_pockets_user_id", table_name="savings_pockets")
    op.drop_table("savings_pockets")
    op.drop_index("ix_transactions_user_id", table_name="transactions")
    op.drop_table("transactions")
    op.drop_index("ix_transfers_user_id", table_name="transfers")
    op.drop_table("transfers")
    op.drop_index("ix_bank_cards_user_id", table_name="bank_cards")
    op.drop_table("bank_cards")
