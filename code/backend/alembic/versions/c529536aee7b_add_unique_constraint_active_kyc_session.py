"""add_unique_constraint_active_kyc_session

Revision ID: c529536aee7b
Revises: 022_ocr_status
Create Date: 2026-05-02 14:00:28.657981

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c529536aee7b'
down_revision: Union[str, Sequence[str], None] = '022_ocr_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unique partial index to prevent multiple active KYC sessions per user.
    
    This constraint ensures that a user can only have ONE active KYC session
    (status IN ['DRAFT', 'PENDING_INFO']) at any given time. This prevents
    the MultipleResultsFound exception that occurred when users had multiple
    active sessions after resets or abandoned flows.
    
    The partial index only applies to active sessions, so completed/abandoned
    sessions don't conflict.
    """
    op.execute("""
        UPDATE kyc_sessions
        SET status = 'ABANDONED'
        WHERE id IN (
            SELECT id
            FROM (
                SELECT id,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id
                        ORDER BY started_at DESC
                    ) AS rn
                FROM kyc_sessions
                WHERE status IN ('DRAFT', 'PENDING_INFO')
            ) AS ranked
            WHERE rn > 1
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX uq_kyc_session_active_per_user 
        ON kyc_sessions (user_id) 
        WHERE status IN ('DRAFT', 'PENDING_INFO')
    """)


def downgrade() -> None:
    """Remove the unique partial index."""
    op.execute("DROP INDEX IF EXISTS uq_kyc_session_active_per_user")
