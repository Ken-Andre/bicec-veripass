"""otp_session: add hash_algo and used_at columns

Revision ID: a1b2c3d4e5f6
Revises: d6e8c2e05497
Create Date: 2026-03-21 00:00:00.000000

Adds:
- hash_algo (VARCHAR 20, default 'bcrypt') — records the hashing algorithm used for code_hash
- used_at (TIMESTAMPTZ, nullable) — records when the OTP was successfully consumed
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "d6e8c2e05497"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "otp_sessions",
        sa.Column(
            "hash_algo", sa.String(length=20), nullable=False, server_default="bcrypt"
        ),
    )
    op.add_column(
        "otp_sessions",
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("otp_sessions", "used_at")
    op.drop_column("otp_sessions", "hash_algo")
