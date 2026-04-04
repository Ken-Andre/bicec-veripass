"""019_aml_gatekeeper_integration

Ajoute les tables pour l'intégration veripass-gatekeeper :
- niu_conflicts (déduplication identité)
- batch_jobs (provisionnement Amplitude)
- Modifie agencies (ajout region, commune, quartier)

Revision ID: 019_aml_gatekeeper
Revises: 018_agent_lockout_fields
Create Date: 2026-04-01
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "019_aml_gatekeeper"
down_revision: Union[str, Sequence[str], None] = "018_agent_lockout_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Table niu_conflicts
    op.create_table(
        "niu_conflicts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("niu", sa.Text(), nullable=False, index=True),
        sa.Column("session_id_new", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id_existing", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("similarity_score", sa.DECIMAL(5, 4), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="PENDING"),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["session_id_new"], ["kyc_sessions.id"]),
        sa.ForeignKeyConstraint(["session_id_existing"], ["kyc_sessions.id"]),
        sa.ForeignKeyConstraint(["resolved_by"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Table batch_jobs
    op.create_table(
        "batch_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_type", sa.Text(), nullable=False, server_default="AMPLITUDE_PROVISIONING"),
        sa.Column("status", sa.Text(), nullable=False, server_default="PENDING"),
        sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_items", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by"], ["agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Enrichir agencies (ajout région/commune/quartier si absents)
    op.add_column("agencies", sa.Column("region", sa.Text(), nullable=True, server_default=sa.text("NULL")))
    op.add_column("agencies", sa.Column("commune", sa.Text(), nullable=True, server_default=sa.text("NULL")))
    op.add_column("agencies", sa.Column("quartier", sa.Text(), nullable=True, server_default=sa.text("NULL")))


def downgrade() -> None:
    op.drop_column("agencies", "quartier")
    op.drop_column("agencies", "commune")
    op.drop_column("agencies", "region")
    op.drop_table("batch_jobs")
    op.drop_table("niu_conflicts")