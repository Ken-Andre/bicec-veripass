"""merge heads: 013_dwh + a1b2c3d4e5f6

Revision ID: 014_merge_heads
Revises: 013_dwh, a1b2c3d4e5f6
Create Date: 2026-03-21 12:00:00.000000
"""
from typing import Sequence, Union

revision: str = "014_merge_heads"
down_revision: Union[str, Sequence[str], None] = ("013_dwh", "a1b2c3d4e5f6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
