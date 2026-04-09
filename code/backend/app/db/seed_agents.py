"""Seed script to create initial back-office agents (Jean, Thomas, Sylvie, Admin IT).

This script is idempotent — running it multiple times won't create duplicates.

Environment Variables:
    SEED_AGENT_PASSWORD: Default password for seeded agents (default: "password123")
    SEED_ADMIN_PASSWORD: Password for Admin IT (default: "admin123")

Usage:
    uv run python app/db/seed_agents.py

Security Note:
    These credentials are for DEVELOPMENT/STAGING only.
    In production, agents should be created via Admin IT interface with unique credentials.
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.modules.auth.models import Agent, AgentRole
from app.modules.admin.models import Agency


# Development-only default credentials
# In production, these should be set via environment variables or created via admin UI
DEFAULT_AGENT_PASSWORD = os.getenv("SEED_AGENT_PASSWORD", "password123")
DEFAULT_ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "admin123")


async def seed_agents(db: AsyncSession):
    """Create default agencies and agents if they don't exist."""

    # ===== Create default agency if not exists =====
    result = await db.execute(select(Agency).where(Agency.code == "DLA-001"))
    agency = result.scalar_one_or_none()

    if not agency:
        agency = Agency(
            code="DLA-001",
            name="Agence Douala Bonanjo",
            city="Douala",
            is_active=True,
        )
        db.add(agency)
        await db.commit()
        await db.refresh(agency)
        print(f"✓ Created agency: {agency.code} - {agency.name}")
    else:
        print(f"✓ Agency already exists: {agency.code}")

    # ===== Create agents if not exist =====
    agents_data = [
        {
            "email": "jean.mbarga@bicec.cm",
            "name": "Jean Mbarga",
            "role": AgentRole.JEAN,
        },
        {
            "email": "thomas.ndongo@bicec.cm",
            "name": "Thomas Ndongo",
            "role": AgentRole.THOMAS,
        },
        {
            "email": "sylvie.fouda@bicec.cm",
            "name": "Sylvie Fouda",
            "role": AgentRole.SYLVIE,
        },
        {
            "email": "admin@bicec.cm",
            "name": "Administrateur Système",
            "role": AgentRole.ADMIN_IT,
        },
    ]

    for agent_data in agents_data:
        result = await db.execute(
            select(Agent).where(Agent.email == agent_data["email"])
        )
        existing_agent = result.scalar_one_or_none()

        if existing_agent:
            print(
                f"✓ Agent already exists: {agent_data['email']} ({agent_data['role'].value})"
            )
        else:
            raw_password = (
                DEFAULT_ADMIN_PASSWORD
                if agent_data["role"] == AgentRole.ADMIN_IT
                else DEFAULT_AGENT_PASSWORD
            )
            agent = Agent(
                agency_id=agency.id,
                name=agent_data["name"],
                email=agent_data["email"],
                password_hash=hash_password(raw_password),
                role=agent_data["role"],
                is_available=True,
            )
            db.add(agent)
            print(
                f"✓ Created agent: {agent.name} ({agent.email}) - Role: {agent.role.value}"
            )

    await db.commit()
    print("\n✓ Seed completed successfully!")
    print("\n⚠️  WARNING: Default credentials are for DEVELOPMENT only!")
    print("   Change passwords in production via Admin IT interface.\n")


async def main():
    """Main entry point for seed script."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed_agents(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
