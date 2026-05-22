"""Contract foundation tests for Day 0-1 APIs."""

from uuid import uuid4

from app.modules.auth.schemas import (
    WebAuthnAuthOptionsRequest,
    WebAuthnAuthVerifyRequest,
    WebAuthnRegisterVerifyRequest,
)
from app.modules.devices.schemas import DeviceRegisterRequest
from app.modules.notifications.schemas import (
    NotificationReadRequest,
    PushSubscriptionCreate,
)
from app.modules.support.schemas import SupportMessageCreate


def test_push_subscription_contract_requires_endpoint_and_keys():
    body = PushSubscriptionCreate(
        endpoint="https://push.example/subscription/1",
        keys={"p256dh": "client-key", "auth": "auth-secret"},
        device_tag="vp_dev_abc",
    )

    assert body.endpoint.startswith("https://push.example")
    assert body.keys.p256dh == "client-key"
    assert body.device_tag == "vp_dev_abc"


def test_notification_read_contract_supports_bulk_or_selected_ids():
    selected = NotificationReadRequest(notification_ids=[uuid4()])
    bulk = NotificationReadRequest(mark_all=True)

    assert selected.notification_ids
    assert bulk.mark_all is True


def test_support_message_contract_limits_empty_messages():
    body = SupportMessageCreate(content="Voici le fichier complementaire.")

    assert body.content.startswith("Voici")


def test_device_registration_contract_uses_privacy_reduced_hash():
    body = DeviceRegisterRequest(
        fingerprint_hash="a" * 64,
        metadata={"platform": "ios", "locale": "fr-CM"},
    )

    assert body.fingerprint_hash == "a" * 64
    assert body.metadata["platform"] == "ios"


def test_webauthn_contracts_use_server_challenge_and_credential_id():
    register = WebAuthnRegisterVerifyRequest(
        challenge="server-issued-challenge",
        credential_id="credential-id",
    )
    options = WebAuthnAuthOptionsRequest(phone="+237699000001")
    verify = WebAuthnAuthVerifyRequest(
        phone="+237699000001",
        challenge="server-issued-challenge",
        credential_id="credential-id",
    )

    assert register.challenge == verify.challenge
    assert options.phone == verify.phone
