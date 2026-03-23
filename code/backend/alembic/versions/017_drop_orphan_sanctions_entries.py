"""017_drop_orphan_sanctions_entries

Revision ID: 017_drop_orphan_sanctions
Revises: 016_drop_orphan_consents
Create Date: 2026-03-21 14:30:00.000000

Changes:
- Drops the orphan `sanctions_entries` table created in migration 012_aml.
  No SQLAlchemy model was ever created for it.
- Drops the dangling FK column `aml_alerts.sanctions_entry_id` added in 012_aml.

The canonical AML/sanctions model is `PEPSanctions` (table `pep_sanctions`, initial schema)
linked to `AMLAlert` via `aml_alerts.pep_sanctions_id`. That relationship is intact and unchanged.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "017_drop_orphan_sanctions"
down_revision: Union[str, Sequence[str], None] = "016_drop_orphan_consents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop dangling FK column on aml_alerts first (references sanctions_entries)
    op.drop_index("ix_aml_alerts_sanctions_entry_id", table_name="aml_alerts")
    op.drop_constraint("fk_aml_alerts_sanctions_entry_id", "aml_alerts", type_="foreignkey")
    op.drop_column("aml_alerts", "sanctions_entry_id")

    # Drop orphan table and its trigram index
    op.execute("DROP INDEX IF EXISTS ix_sanctions_entries_full_name_trgm")
    op.drop_table("sanctions_entries")


def downgrade() -> None:
    # Recreate sanctions_entries as it was in 012_aml
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
    op.execute(
        "CREATE INDEX ix_sanctions_entries_full_name_trgm "
        "ON sanctions_entries USING gin (full_name gin_trgm_ops)"
    )
    op.add_column("aml_alerts", sa.Column("sanctions_entry_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_aml_alerts_sanctions_entry_id",
        "aml_alerts",
        "sanctions_entries",
        ["sanctions_entry_id"],
        ["id"],
    )
    op.create_index("ix_aml_alerts_sanctions_entry_id", "aml_alerts", ["sanctions_entry_id"], unique=False)
