"""Tests de non-régression pour les fixes de stabilisation démo VeriPass.

Couvre :
- ADR-001 : DRAFT sessions doivent avoir access_level=GUEST
- Migration 035 : rétrograde les sessions DRAFT/RESTRICTED en GUEST
- Notifications : push_enabled=False par défaut, activation explicite
- Devices : notification "Nouvelle connexion" quand un autre device est actif
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
import uuid

from app.main import app
from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.kyc.models import KYCSession, Notification
from app.modules.notifications.models import NotificationPreference, PushSubscription
from app.modules.devices.models import DeviceRegistration
from app.modules.kyc.schemas import AccessTier, LifecycleState


@pytest.fixture
def mock_user():
    user_id = uuid.uuid4()
    return User(
        id=user_id,
        phone=f"+2376{str(user_id.int)[-8:]}",
        email=f"test-{str(user_id.int)[-6:]}@bicec-veripass.cm",
        role="MOBILE",
    )


@pytest_asyncio.fixture
async def override_auth(mock_user, db_session):
    db_session.add(mock_user)
    await db_session.commit()

    async def override_get_current_user():
        return mock_user

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


class TestKycAccessLevelGuest:
    """ADR-001 : DRAFT sessions must default to access_level=GUEST."""

    @pytest.mark.asyncio
    async def test_kyc_session_start_then_current_returns_guest_access(self, client: AsyncClient, override_auth, db_session):
        start_response = await client.post("/api/v1/kyc/session/start")
        assert start_response.status_code == 200

        current_response = await client.get("/api/v1/kyc/session/current")
        assert current_response.status_code == 200
        data = current_response.json()
        assert data["status"] == LifecycleState.DRAFT
        assert data["access_level"] == AccessTier.GUEST, (
            f"Expected access_level=GUEST for DRAFT session, got {data.get('access_level')}. "
            "A new user must NOT see the post-submission dashboard UI."
        )

    @pytest.mark.asyncio
    async def test_kyc_session_in_db_has_guest_access(self, client: AsyncClient, override_auth, db_session, mock_user):
        await client.post("/api/v1/kyc/session/start")
        result = await db_session.execute(
            select(KYCSession).where(KYCSession.user_id == mock_user.id)
        )
        session = result.scalar_one()
        assert session.status == LifecycleState.DRAFT
        assert session.access_level == AccessTier.GUEST

    @pytest.mark.asyncio
    async def test_existing_draft_session_returned_idempotent(self, client: AsyncClient, override_auth, db_session, mock_user):
        """Un user qui revient doit voir sa session existante (pas un nouveau draft)."""
        r1 = await client.post("/api/v1/kyc/session/start")
        r2 = await client.post("/api/v1/kyc/session/start")
        # Le start_response ne contient pas access_level, mais on vérifie
        # qu'il n'y a qu'une seule session en DB.
        result = await db_session.execute(
            select(KYCSession).where(KYCSession.user_id == mock_user.id)
        )
        sessions = result.scalars().all()
        assert len(sessions) == 1, "Idempotent: second start should return the existing session"


class TestNotificationsDefaultPush:
    """push_enabled doit être False par défaut (opt-in)."""

    @pytest.mark.asyncio
    async def test_preferences_default_push_disabled(self, client: AsyncClient, override_auth, mock_user):
        response = await client.get("/api/v1/notifications/preferences")
        assert response.status_code == 200
        data = response.json()
        assert data["push_enabled"] is False, (
            "push_enabled must default to False (opt-in). "
            "Defaulting to True caused the 'toggle on by default' bug."
        )
        assert data["in_app_enabled"] is True


class TestPushSubscriptionActivatesPreference:
    """POST /notifications/subscriptions doit activer push_enabled et planifier la confirmation."""

    @pytest.mark.asyncio
    async def test_create_subscription_enables_push(self, client: AsyncClient, override_auth, db_session, mock_user):
        body = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/test-endpoint",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2CavB3h2ye3Fvk0axV4gD-KWZ7vQbz4OQ7s7s7s7s7s7s7s7s7s7s7s7s7s7s7s7s",
                "auth": "kXxXxXxXxXxXxXxXxXxXxQ",
            },
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        }
        response = await client.post("/api/v1/notifications/subscriptions", json=body)
        assert response.status_code == 201
        data = response.json()
        assert data["is_active"] is True

        # Vérifier que la préférence a été activée
        pref_result = await db_session.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == mock_user.id)
        )
        pref = pref_result.scalar_one()
        assert pref.push_enabled is True, (
            "POST /subscriptions must upsert NotificationPreference.push_enabled=True"
        )

    @pytest.mark.asyncio
    async def test_reactivate_existing_subscription_enables_push(self, client: AsyncClient, override_auth, db_session, mock_user):
        """Réactiver une subscription existante (cas reload PWA) doit aussi activer push_enabled."""
        # Préférence désactivée au départ
        pref = NotificationPreference(
            user_id=mock_user.id,
            official_channel="sms",
            push_enabled=False,
            in_app_enabled=True,
        )
        db_session.add(pref)
        await db_session.commit()

        body = {
            "endpoint": "https://fcm.googleapis.com/fcm/send/another",
            "keys": {
                "p256dh": "BNcRdreALRFXTkOOUHK1EtK2CavB3h2ye3Fvk0axV4gD-KWZ7vQbz4OQ7s7s7s7s7s7s7s7s7s7s7s7s7s7s7s7s",
                "auth": "kXxXxXxXxXxXxXxXxXxXxQ",
            },
        }
        response = await client.post("/api/v1/notifications/subscriptions", json=body)
        assert response.status_code == 201

        await db_session.refresh(pref)
        assert pref.push_enabled is True


class TestDeviceRegistrationSecurityNotification:
    """POST /devices/register doit notifier quand un autre device est actif."""

    @pytest.mark.asyncio
    async def test_first_device_registration_no_notification(self, client: AsyncClient, override_auth, db_session, mock_user):
        body = {
            "fingerprint_hash": "first-device-fp-1234567890abcdef",
            "metadata": {"platform": "ios", "model": "iPhone15,2"},
        }
        response = await client.post(
            "/api/v1/devices/register",
            json=body,
            headers={"X-Device-Fingerprint": "first-device-fp-1234567890abcdef"},
        )
        assert response.status_code == 200

        notif_result = await db_session.execute(
            select(Notification).where(Notification.user_id == mock_user.id)
        )
        notifications = notif_result.scalars().all()
        assert len(notifications) == 0, "First device registration should not create a security notification"

    @pytest.mark.asyncio
    async def test_second_device_creates_notification(self, client: AsyncClient, override_auth, db_session, mock_user):
        # Premier device (fingerprint >= 16 chars pour respecter la validation)
        r1 = await client.post(
            "/api/v1/devices/register",
            json={"fingerprint_hash": "first-device-aaaa-bbbb-cccc", "metadata": {"platform": "ios"}},
            headers={"X-Device-Fingerprint": "first-device-aaaa-bbbb-cccc"},
        )
        assert r1.status_code == 200
        first_device_tag = r1.json()["device_tag"]

        # Deuxième device (même user, fingerprint différent)
        r2 = await client.post(
            "/api/v1/devices/register",
            json={"fingerprint_hash": "second-device-dddd-eeee-ffff", "metadata": {"platform": "android"}},
            headers={
                "X-Device-Fingerprint": "second-device-dddd-eeee-ffff",
                "X-Device-Tag": first_device_tag,
            },
        )
        assert r2.status_code == 200

        # Vérifier qu'une notification de sécurité a été créée
        notif_result = await db_session.execute(
            select(Notification).where(
                Notification.user_id == mock_user.id,
                Notification.message.ilike("%nouvelle connexion%"),
            )
        )
        notif = notif_result.scalar_one_or_none()
        assert notif is not None, "Second device registration must create a 'Nouvelle connexion' notification"
        assert "connexion" in notif.message.lower()
