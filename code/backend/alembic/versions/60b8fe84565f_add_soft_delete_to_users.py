"""add soft delete to users

Revision ID: 60b8fe84565f
Revises: 50a7fe83564e
Create Date: 2026-04-26 07:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '60b8fe84565f'
down_revision: Union[str, Sequence[str], None] = '50a7fe83564e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_deleted column to users if it doesn't exist
    op.add_column('users', sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False))
    
    # Add deleted_at column to users
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    
    # Create the index
    op.create_index(op.f('ix_users_is_deleted'), 'users', ['is_deleted'], unique=False)
    
    # Audit comments
    op.execute("COMMENT ON COLUMN users.is_deleted IS 'Soft delete flag - authentication blocked for deleted users, data retained for COBAC compliance (10 years)';")
    op.execute("COMMENT ON COLUMN users.deleted_at IS 'Timestamp of account deletion for audit trail and compliance retention period tracking';")


def downgrade() -> None:
    op.drop_index(op.f('ix_users_is_deleted'), table_name='users')
    op.drop_column('users', 'deleted_at')
    op.drop_column('users', 'is_deleted')
