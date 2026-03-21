"""012_aml

Revision ID: 012_aml
Revises: 011_address_niu
Create Date: 2026-03-21 08:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "012_aml"
down_revision: Union[str, Sequence[str], None] = "011_address_niu"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Must be first in this migration per issue requirements.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "sanctions_entries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_list", sa.String(length=60), nullable=False),
        sa.Column("external_ref", sa.String(length=120), nullable=True),
        sa.Column("full_name", sa.Text(), nullable=False),
        sa.Column("aliases", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("country", sa.String(length=80), nullable=True),
        sa.Column("programs", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("entity_type", sa.String(length=40), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )

    # GIN trigram index on sanctions_entries.full_name
    op.execute(
        "CREATE INDEX ix_sanctions_entries_full_name_trgm "
        "ON sanctions_entries USING gin (full_name gin_trgm_ops)"
    )

    # Keep existing aml_alerts table but wire it to sanctions_entries for AML matching lifecycle.
    op.add_column("aml_alerts", sa.Column("sanctions_entry_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_aml_alerts_sanctions_entry_id",
        "aml_alerts",
        "sanctions_entries",
        ["sanctions_entry_id"],
        ["id"],
    )
    op.create_index("ix_aml_alerts_sanctions_entry_id", "aml_alerts", ["sanctions_entry_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_aml_alerts_sanctions_entry_id", table_name="aml_alerts")
    op.drop_constraint("fk_aml_alerts_sanctions_entry_id", "aml_alerts", type_="foreignkey")
    op.drop_column("aml_alerts", "sanctions_entry_id")
    op.execute("DROP INDEX IF EXISTS ix_sanctions_entries_full_name_trgm")
    op.drop_table("sanctions_entries")
