import pytest
from pydantic import ValidationError

from app.core import config as config_module
from app.core.config import Settings
from app.modules.notifications import service as notification_service


@pytest.mark.asyncio
async def test_send_sms_notification_simulates_in_dev_local(monkeypatch: pytest.MonkeyPatch):
    async def unexpected_send_sms(phone_number: str, message: str):
        raise AssertionError("orange_sms.send_sms should not be called in dev_local mode")

    monkeypatch.setattr(config_module.settings, "OTP_MODE", "dev_local")
    monkeypatch.setattr(notification_service.orange_sms, "send_sms", unexpected_send_sms)

    result = await notification_service.send_sms_notification(
        "+237670000000",
        "Votre code VeriPass est 987654. Il expire dans 10 minutes.",
    )

    assert result == {
        "status": "simulated",
        "mode": "dev_local",
        "phone_number": "+237670000000",
        "message_preview": "Votre code VeriPass ...",
    }


@pytest.mark.asyncio
async def test_send_sms_notification_uses_orange_client_outside_dev_local(
    monkeypatch: pytest.MonkeyPatch,
):
    expected = {
        "outboundSMSMessageRequest": {
            "resourceURL": "https://api.orange.com/sms/123"
        }
    }

    async def fake_send_sms(phone_number: str, message: str):
        assert phone_number == "+237670000001"
        assert message == "OTP 123456"
        return expected

    monkeypatch.setattr(config_module.settings, "OTP_MODE", "orange")
    monkeypatch.setattr(notification_service.orange_sms, "send_sms", fake_send_sms)

    result = await notification_service.send_sms_notification("+237670000001", "OTP 123456")

    assert result == expected


def test_settings_reject_dev_local_mode_in_production():
    with pytest.raises(ValidationError, match="OTP_MODE 'dev_local' is NOT allowed in production environment"):
        Settings(ENVIRONMENT="production", OTP_MODE="dev_local")
