import uuid

import pytest
from sqlalchemy import func, select

from app.modules.aml import service
from app.modules.auth.models import Agent, AgentRole
from app.modules.kyc.models import PEPSanctions


@pytest.mark.asyncio
async def test_aml_list_import_dry_run_validates_without_writing(db_session):
    csv_text = service.aml_import_template_csv()
    before_count = (
        await db_session.execute(select(func.count()).select_from(PEPSanctions))
    ).scalar()

    report = await service.import_aml_list_csv(
        db_session,
        csv_text=csv_text,
        filename="template.csv",
        dry_run=True,
        agent=None,
    )

    assert report["dryRun"] is True
    assert report["status"] == "DRY_RUN"
    assert report["totalRows"] == 1
    assert report["failedRows"] == 0

    after_count = (
        await db_session.execute(select(func.count()).select_from(PEPSanctions))
    ).scalar()
    assert after_count == before_count


@pytest.mark.asyncio
async def test_aml_list_import_writes_internal_entries(db_session):
    agent = Agent(
        id=uuid.uuid4(),
        email=f"thomas.import.{uuid.uuid4()}@example.test",
        name="Thomas Import",
        password_hash="x",
        role=AgentRole.THOMAS,
    )
    db_session.add(agent)
    await db_session.commit()

    csv_text = (
        "source,list_type,entity_type,full_name,aliases,date_of_birth,nationality,programs,is_active\n"
        "BICEC_INTERNAL,SANCTIONS,INDIVIDUAL,TEST PERSON,ALIAS ONE,1970-01-31,CM,Internal list,true\n"
    )

    report = await service.import_aml_list_csv(
        db_session,
        csv_text=csv_text,
        filename="internal.csv",
        dry_run=False,
        agent=agent,
    )

    assert report["status"] == "IMPORTED"
    assert report["importedRows"] == 1
    entry = (
        await db_session.execute(
            select(PEPSanctions).where(PEPSanctions.source == "BICEC_INTERNAL")
        )
    ).scalar_one()
    assert entry.full_name == "TEST PERSON"
    assert entry.programs[0] == "SANCTIONS"
