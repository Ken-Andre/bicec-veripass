"""020_add_agencies_city_is_active

Ajoute les colonnes city et is_active à la table agencies.
Ces colonnes existent dans le modèle SQLAlchemy mais aucune migration ne les créait.

Revision ID: 020_agencies_city_active
Revises: 019_aml_gatekeeper
Create Date: 2026-05-17
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "020_agencies_city_active"
down_revision: Union[str, Sequence[str], None] = "019_aml_gatekeeper"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agencies", sa.Column("city", sa.String(100), nullable=True))
    op.add_column(
        "agencies", sa.Column("is_active", sa.Boolean(), server_default="true")
    )


def downgrade() -> None:
    op.drop_column("agencies", "is_active")
    op.drop_column("agencies", "city")
