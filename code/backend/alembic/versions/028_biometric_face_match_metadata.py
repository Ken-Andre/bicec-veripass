"""028_biometric_face_match_metadata

Revision ID: 028_face_match_metadata
Revises: 027_add_atms_table
Create Date: 2026-05-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "028_face_match_metadata"
down_revision: Union[str, Sequence[str], None] = "027_add_atms_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "biometric_results",
        sa.Column("face_match_status", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "biometric_results",
        sa.Column("face_match_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "biometric_results",
        sa.Column("face_match_distance", sa.Numeric(precision=8, scale=6), nullable=True),
    )
    op.add_column(
        "biometric_results",
        sa.Column("face_match_threshold", sa.Numeric(precision=5, scale=4), nullable=True),
    )
    op.add_column(
        "biometric_results",
        sa.Column("face_match_detector", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("biometric_results", "face_match_detector")
    op.drop_column("biometric_results", "face_match_threshold")
    op.drop_column("biometric_results", "face_match_distance")
    op.drop_column("biometric_results", "face_match_reason")
    op.drop_column("biometric_results", "face_match_status")
