"""023_add_ocr_review_confirmed

Revision ID: 023_ocr_review_confirmed
Revises: c529536aee7b
Create Date: 2026-05-06 04:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "023_ocr_review_confirmed"
down_revision: Union[str, Sequence[str], None] = "c529536aee7b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kyc_sessions",
        sa.Column(
            "ocr_review_confirmed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("kyc_sessions", "ocr_review_confirmed")
