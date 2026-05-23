"""Unit tests for seed_data.py — no DB required (pure logic tests)."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.db.seed_data import SEED_AGENCY, SEED_AGENTS, seed_development_data
from app.core.security import hash_password, verify_password


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def test_seed_passwords_are_hashed():
    """Seed agents must not store plain-text passwords."""
    for agent in SEED_AGENTS:
        hashed = hash_password(agent["password"])
        assert hashed != agent["password"]
        assert verify_password(agent["password"], hashed)


def test_seed_passwords_are_unique_hashes():
    """Each call to hash_password produces a different hash (bcrypt salting)."""
    h1 = hash_password("password123")
    h2 = hash_password("password123")
    assert h1 != h2  # different salts


# ---------------------------------------------------------------------------
# Seed data structure
# ---------------------------------------------------------------------------


def test_seed_agents_have_required_fields():
    required = {"name", "email", "password", "role"}
    for agent in SEED_AGENTS:
        assert required.issubset(agent.keys()), f"Missing fields in {agent}"


def test_seed_agents_roles():
    expected_roles = {"JEAN", "THOMAS", "SYLVIE", "ADMIN_IT"}
    actual_roles = {a["role"] for a in SEED_AGENTS}
    assert actual_roles == expected_roles


def test_seed_agents_emails_unique():
    emails = [a["email"] for a in SEED_AGENTS]
    assert len(emails) == len(set(emails))


def test_seed_agency_has_required_fields():
    assert "name" in SEED_AGENCY
    assert "code" in SEED_AGENCY


# ---------------------------------------------------------------------------
# Idempotence — mock DB session
# ---------------------------------------------------------------------------


def _make_scalar_result(value):
    """Helper: mock scalar_one_or_none() returning value."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.asyncio
async def test_seed_skips_existing_agency_and_agents():
    """When agency and all agents already exist, no db.add() calls are made."""
    from app.modules.admin.models import Agency
    from app.modules.auth.models import Agent

    existing_agency = MagicMock(spec=Agency)
    existing_agency.id = "existing-id"
    existing_agent = MagicMock(spec=Agent)

    db = AsyncMock()
    db.add = MagicMock()
    side_effects = [_make_scalar_result(existing_agency)] + [
        _make_scalar_result(existing_agent) for _ in SEED_AGENTS
    ]
    db.execute.side_effect = side_effects

    await seed_development_data(db)

    db.add.assert_not_called()
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_seed_creates_agency_and_agents_when_missing():
    """When nothing exists, db.add() is called for agency + all agents."""

    db = AsyncMock()
    db.flush = AsyncMock()

    side_effects = [_make_scalar_result(None)] + [
        _make_scalar_result(None) for _ in SEED_AGENTS
    ]
    db.execute.side_effect = side_effects

    # After flush, the agency object added to db needs an id — simulate it
    db.add = MagicMock()  # sync mock — db.add() is not a coroutine in SQLAlchemy

    await seed_development_data(db)

    # 1 agency + 4 agents
    assert db.add.call_count == 1 + len(SEED_AGENTS)
    db.flush.assert_called_once()
    db.commit.assert_called_once()
