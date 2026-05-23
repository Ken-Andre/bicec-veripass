"""add agent lockout fields

Revision ID: 018_agent_lockout_fields
Revises: 017_drop_orphan_sanctions
Create Date: 2026-03-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "018_agent_lockout_fields"
down_revision: Union[str, Sequence[str], None] = "017_drop_orphan_sanctions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column(
            "failed_login_attempts", sa.Integer(), nullable=True, server_default="0"
        ),
    )
    op.add_column(
        "agents", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True)
    )
    op.execute(
        "UPDATE agents SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL"
    )
    op.alter_column("agents", "failed_login_attempts", server_default=None)


def downgrade() -> None:
    op.drop_column("agents", "locked_until")
    op.drop_column("agents", "failed_login_attempts")
