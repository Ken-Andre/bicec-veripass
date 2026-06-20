"""fix_draft_session_default_access_level

Revision ID: 035_fix_draft_access_level
Revises: 034_pep_sanctions_source_text
Create Date: 2026-06-18 14:30:00.000000

ADR-001 alignment: a freshly created KYC session in DRAFT must default to
access_level=GUEST, not RESTRICTED. The previous default caused new users
to land on the post-submission dashboard UI ("Merci pour votre confiance")
before they had even opened a single KYC step.

This migration performs two corrective actions:

1. Backfill existing DRAFT sessions whose access_level is still RESTRICTED
   (created before the model default was changed in models.py) so that
   already-registered users see the correct "Dossier à compléter" UI on
   their next dashboard load.

2. Rewrites the SQLAlchemy default for the column from 'RESTRICTED' to
   'GUEST' so future ORM inserts respect the new contract even when the
   caller omits the field explicitly.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "035_fix_draft_access_level"
down_revision: Union[str, Sequence[str], None] = "034_pep_sanctions_source_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Retrograde DRAFT sessions and align the column default with ADR-001."""
    # 1. Data fix: downgrade DRAFT sessions currently flagged RESTRICTED.
    op.execute(
        """
        UPDATE kyc_sessions
        SET access_level = 'GUEST'
        WHERE status = 'DRAFT'
          AND access_level = 'RESTRICTED'
        """
    )

    # 2. Schema fix: align the column default so future ORM inserts match.
    op.execute(
        "ALTER TABLE kyc_sessions "
        "ALTER COLUMN access_level SET DEFAULT 'GUEST'"
    )


def downgrade() -> None:
    """Revert the column default and restore the prior RESTRICTED rows.

    The downgrade is intentionally a no-op for the data fix (we do not
    blindly flip GUEST back to RESTRICTED because that would re-introduce
    the original bug). The schema default is restored to its previous value
    so a downgrade paired with the models.py revert remains consistent.
    """
    op.execute(
        "ALTER TABLE kyc_sessions "
        "ALTER COLUMN access_level SET DEFAULT 'RESTRICTED'"
    )
