"""Seed data pour l'environnement de développement.

Ce script crée une Agency par défaut et 4 comptes agents de démonstration.

=============================================================================
IMPORTANT — Rôles fonctionnels vs Personas de démonstration
=============================================================================
Les rôles JEAN / THOMAS / SYLVIE / ADMIN_IT sont des IDENTIFIANTS FONCTIONNELS
définis dans l'architecture (§ADR-009, §7.3 Data Dictionary). Ce ne sont PAS
des noms de personnes réelles.

Les comptes créés ici sont des FIXTURES DE DÉMONSTRATION dont les noms
correspondent aux personas UX du PRD. En production, un vrai agent
"Kouam Bertrand" aura role=JEAN dans la DB — son prénom n'est pas "Jean".

    Persona demo      | Email             | Rôle fonctionnel
    ------------------|-------------------|---------------------------
    Jean Dupont       | jean@bicec.cm     | JEAN   = Agent KYC Validateur
    Thomas Martin     | thomas@bicec.cm   | THOMAS = Superviseur AML/CFT
    Sylvie Bernard    | sylvie@bicec.cm   | SYLVIE = Directrice Opérations
    Admin IT          | admin@bicec.cm    | ADMIN_IT = Administrateur Système

Idempotent : ne recrée pas si déjà existant.
Conditions d'exécution : ENVIRONMENT=development OU SEED_DATA=true
=============================================================================
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.logging import logger
from app.core.security import hash_password
from app.modules.admin.models import Agency
from app.modules.auth.models import Agent, AgentRole


SEED_AGENCY = {
    "name": "BICEC Siège",
    "code": "BICEC-SIEGE",
    "location": "Yaoundé, Cameroun",
}

SEED_AGENTS = [
    {"name": "Jean Dupont",   "email": "jean@bicec.cm",   "password": "password123", "role": "JEAN"},
    {"name": "Thomas Martin", "email": "thomas@bicec.cm", "password": "password123", "role": "THOMAS"},
    {"name": "Sylvie Bernard","email": "sylvie@bicec.cm", "password": "password123", "role": "SYLVIE"},
    {"name": "Admin IT",      "email": "admin@bicec.cm",  "password": "password123", "role": "ADMIN_IT"},
]


async def seed_development_data(db: AsyncSession) -> None:
    """Seed agency and agents. Safe to call multiple times (idempotent)."""

    # --- Agency ---
    result = await db.execute(select(Agency).where(Agency.code == SEED_AGENCY["code"]))
    agency = result.scalar_one_or_none()
    if not agency:
        agency = Agency(
            id=uuid.uuid4(),
            name=SEED_AGENCY["name"],
            code=SEED_AGENCY["code"],
            location=SEED_AGENCY["location"],
        )
        db.add(agency)
        await db.flush()  # get agency.id before creating agents
        logger.info(f"Seed: created agency '{agency.name}'")
    else:
        logger.info(f"Seed: agency '{agency.name}' already exists, skipping")

    # --- Agents ---
    for agent_data in SEED_AGENTS:
        result = await db.execute(select(Agent).where(Agent.email == agent_data["email"]))
        existing = result.scalar_one_or_none()
        if not existing:
            agent = Agent(
                id=uuid.uuid4(),
                agency_id=agency.id,
                name=agent_data["name"],
                email=agent_data["email"],
                password_hash=hash_password(agent_data["password"]),
                role=AgentRole(agent_data["role"]),
            )
            db.add(agent)
            logger.info(f"Seed: created agent '{agent_data['email']}' (role={agent_data['role']})")
        else:
            logger.info(f"Seed: agent '{agent_data['email']}' already exists, skipping")

    await db.commit()
    logger.info("Seed: done")
