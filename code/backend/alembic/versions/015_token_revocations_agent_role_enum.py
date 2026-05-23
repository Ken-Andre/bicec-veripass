"""add token_revocations table and agent_role enum

Revision ID: 015_token_revocations
Revises: 014_merge_heads
Create Date: 2026-03-21 12:01:00.000000

Changes:
- Creates token_revocations table for refresh token revocation list (H4)
- Creates agent_role enum type and migrates agents.role column (M7)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "015_token_revocations"
down_revision: Union[str, Sequence[str], None] = "014_merge_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

agent_role_enum = postgresql.ENUM(
    "JEAN",
    "THOMAS",
    "SYLVIE",
    "ADMIN_IT",
    name="agent_role",
    create_type=True,
)


def upgrade() -> None:
    # H4: refresh token revocation list
    op.create_table(
        "token_revocations",
        sa.Column("jti", sa.UUID(), nullable=False),
        sa.Column(
            "revoked_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("now()"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index(
        "ix_token_revocations_expires_at",
        "token_revocations",
        ["expires_at"],
        unique=False,
    )

    # M7: agent_role enum — create type then migrate column
    agent_role_enum.create(op.get_bind(), checkfirst=True)
    op.execute(
        "ALTER TABLE agents ALTER COLUMN role TYPE agent_role USING role::agent_role"
    )


def downgrade() -> None:
    # Revert agents.role back to VARCHAR
    op.execute(
        "ALTER TABLE agents ALTER COLUMN role TYPE VARCHAR(20) USING role::VARCHAR"
    )
    agent_role_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_index("ix_token_revocations_expires_at", table_name="token_revocations")
    op.drop_table("token_revocations")
