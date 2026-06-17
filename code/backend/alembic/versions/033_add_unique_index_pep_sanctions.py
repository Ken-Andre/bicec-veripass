"""033_unique_pep_sanctions

Revision ID: 033_unique_pep_sanctions
Revises: 032_legal_document_versions
Create Date: 2026-06-14

Adds UniqueConstraint on (source, full_name) for PEP/Sanctions bulk upsert.
Deduplicates existing rows before applying to avoid IntegrityError.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "033_unique_pep_sanctions"
down_revision: Union[str, Sequence[str], None] = "032_legal_document_versions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Deduplicate existing rows keeping the most recent last_synced_at
    #    Repoint aml_alerts to the surviving row of each (source, full_name) group
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   source,
                   full_name,
                   ROW_NUMBER() OVER (
                       PARTITION BY source, full_name
                       ORDER BY last_synced_at DESC, id
                   ) AS rn
            FROM pep_sanctions
        ),
        duplicate_to_keep AS (
            SELECT d.id AS dup_id, k.id AS keep_id
            FROM ranked d
            JOIN ranked k
              ON k.source = d.source
             AND k.full_name = d.full_name
             AND k.rn = 1
            WHERE d.rn > 1
        )
        UPDATE aml_alerts a
        SET pep_sanctions_id = d.keep_id
        FROM duplicate_to_keep d
        WHERE a.pep_sanctions_id = d.dup_id
        """
    )

    # 2. Now safe to delete the duplicate pep_sanctions rows
    op.execute(
        """
        DELETE FROM pep_sanctions
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY source, full_name
                           ORDER BY last_synced_at DESC, id
                       ) AS rn
                FROM pep_sanctions
            ) dedup
            WHERE rn > 1
        )
        """
    )

    # 3. Add unique constraint for bulk upsert ON CONFLICT
    op.create_unique_constraint(
        "uq_pep_sanctions_source_full_name",
        "pep_sanctions",
        ["source", "full_name"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_pep_sanctions_source_full_name",
        "pep_sanctions",
        type_="unique",
    )
