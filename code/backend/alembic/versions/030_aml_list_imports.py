"""030_aml_list_imports

Revision ID: 030_aml_list_imports
Revises: 029_dwh_analytics_events
Create Date: 2026-05-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "030_aml_list_imports"
down_revision: Union[str, Sequence[str], None] = "029_dwh_analytics_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "aml_list_imports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("list_type", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="DRY_RUN"),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imported_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_report", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_aml_list_imports_source", "aml_list_imports", ["source"])
    op.create_index("ix_aml_list_imports_created_at", "aml_list_imports", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_aml_list_imports_created_at", table_name="aml_list_imports")
    op.drop_index("ix_aml_list_imports_source", table_name="aml_list_imports")
    op.drop_table("aml_list_imports")
