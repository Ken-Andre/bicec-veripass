"""025_contract_foundations

Adds contract foundation tables for device tags, push subscriptions, and
WebAuthn/passkey server challenges and credentials.

Revision ID: 025_contract_foundations
Revises: 024_agencies_city_active
Create Date: 2026-05-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "025_contract_foundations"
down_revision: Union[str, Sequence[str], None] = "024_agencies_city_active"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "device_registrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_tag", sa.String(length=128), nullable=False),
        sa.Column("fingerprint_hash", sa.String(length=128), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_tag"),
        sa.UniqueConstraint("user_id", "fingerprint_hash", name="uq_device_user_fingerprint"),
    )
    op.create_index(op.f("ix_device_registrations_user_id"), "device_registrations", ["user_id"])
    op.create_index(op.f("ix_device_registrations_device_tag"), "device_registrations", ["device_tag"])
    op.create_index(op.f("ix_device_registrations_fingerprint_hash"), "device_registrations", ["fingerprint_hash"])

    op.create_table(
        "push_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.Text(), nullable=False),
        sa.Column("auth", sa.Text(), nullable=False),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("device_tag", sa.String(length=128), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("subscription_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "endpoint", name="uq_push_subscription_user_endpoint"),
    )
    op.create_index(op.f("ix_push_subscriptions_user_id"), "push_subscriptions", ["user_id"])
    op.create_index(op.f("ix_push_subscriptions_device_tag"), "push_subscriptions", ["device_tag"])

    op.create_table(
        "webauthn_credentials",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("credential_id", sa.Text(), nullable=False),
        sa.Column("public_key", sa.Text(), nullable=True),
        sa.Column("sign_count", sa.Integer(), nullable=False),
        sa.Column("transports", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("device_tag", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("credential_id"),
    )
    op.create_index(op.f("ix_webauthn_credentials_user_id"), "webauthn_credentials", ["user_id"])
    op.create_index(op.f("ix_webauthn_credentials_credential_id"), "webauthn_credentials", ["credential_id"])
    op.create_index(op.f("ix_webauthn_credentials_device_tag"), "webauthn_credentials", ["device_tag"])

    op.create_table(
        "webauthn_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("challenge", sa.String(length=128), nullable=False),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("challenge"),
    )
    op.create_index(op.f("ix_webauthn_challenges_user_id"), "webauthn_challenges", ["user_id"])
    op.create_index(op.f("ix_webauthn_challenges_challenge"), "webauthn_challenges", ["challenge"])


def downgrade() -> None:
    op.drop_index(op.f("ix_webauthn_challenges_challenge"), table_name="webauthn_challenges")
    op.drop_index(op.f("ix_webauthn_challenges_user_id"), table_name="webauthn_challenges")
    op.drop_table("webauthn_challenges")
    op.drop_index(op.f("ix_webauthn_credentials_device_tag"), table_name="webauthn_credentials")
    op.drop_index(op.f("ix_webauthn_credentials_credential_id"), table_name="webauthn_credentials")
    op.drop_index(op.f("ix_webauthn_credentials_user_id"), table_name="webauthn_credentials")
    op.drop_table("webauthn_credentials")
    op.drop_index(op.f("ix_push_subscriptions_device_tag"), table_name="push_subscriptions")
    op.drop_index(op.f("ix_push_subscriptions_user_id"), table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
    op.drop_index(op.f("ix_device_registrations_fingerprint_hash"), table_name="device_registrations")
    op.drop_index(op.f("ix_device_registrations_device_tag"), table_name="device_registrations")
    op.drop_index(op.f("ix_device_registrations_user_id"), table_name="device_registrations")
    op.drop_table("device_registrations")
