import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.modules.notifications.router import _to_preference_response
from app.modules.notifications.schemas import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
)


def test_notification_preference_defaults_to_sms_without_email():
    user = SimpleNamespace(id=uuid.uuid4(), email=None)

    response = _to_preference_response(None, user)

    assert response.official_channel == "sms"
    assert response.push_enabled is True
    assert response.in_app_enabled is True


def test_notification_preference_defaults_to_email_when_email_exists():
    user = SimpleNamespace(id=uuid.uuid4(), email="marie@example.com")

    response = _to_preference_response(None, user)

    assert response.official_channel == "email"


def test_notification_preference_response_maps_persisted_values():
    user = SimpleNamespace(id=uuid.uuid4(), email="marie@example.com")
    updated_at = datetime.now(timezone.utc)
    preference = SimpleNamespace(
        official_channel="sms",
        push_enabled=False,
        in_app_enabled=True,
        updated_at=updated_at,
    )

    response = _to_preference_response(preference, user)

    assert response == NotificationPreferenceResponse(
        official_channel="sms",
        push_enabled=False,
        in_app_enabled=True,
        updated_at=updated_at,
    )


def test_notification_preference_update_rejects_unknown_channel():
    with pytest.raises(ValidationError):
        NotificationPreferenceUpdate(official_channel="whatsapp")
