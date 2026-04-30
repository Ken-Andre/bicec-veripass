"""022_add_ocr_status_to_documents

Revision ID: 022_ocr_status
Revises: 021_banking
Create Date: 2026-04-30 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "022_ocr_status"
down_revision: Union[str, Sequence[str], None] = "021_banking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column(
            "ocr_status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
    )
    op.add_column(
        "documents",
        sa.Column("ocr_error", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_documents_ocr_status", "documents", ["ocr_status"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_documents_ocr_status", table_name="documents")
    op.drop_column("documents", "ocr_error")
    op.drop_column("documents", "ocr_status")
