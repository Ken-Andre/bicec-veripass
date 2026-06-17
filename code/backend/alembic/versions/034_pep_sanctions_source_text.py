"""034_pep_sanctions_source_text

Revision ID: 034_pep_sanctions_source_text
Revises: 033_unique_pep_sanctions
Create Date: 2026-06-15

Widens pep_sanctions.source from VARCHAR(100) to TEXT to accommodate
multi-source strings like "OpenCorporates;US OFAC Press Releases;..."
which can exceed 100 characters.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "034_pep_sanctions_source_text"
down_revision: Union[str, Sequence[str], None] = "033_unique_pep_sanctions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "pep_sanctions",
        "source",
        existing_type=sa.String(100),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Truncate any source values > 100 chars before narrowing
    op.execute(
        "UPDATE pep_sanctions SET source = LEFT(source, 100) WHERE LENGTH(source) > 100"
    )
    op.alter_column(
        "pep_sanctions",
        "source",
        existing_type=sa.Text(),
        type_=sa.String(100),
        existing_nullable=False,
    )
