"""Tests for push_sender module."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.modules.notifications.push_sender import send_push_notification


def _make_subscription(**kwargs):
    defaults = dict(
        id="sub-1",
        endpoint="https://push.example/sub1",
        p256dh="key-p256dh",
        auth="key-auth",
        is_active=True,
        last_error=None,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


class TestSendPushNotification:

    @patch("app.modules.notifications.push_sender.webpush")
    @patch("app.modules.notifications.push_sender.settings")
    def test_success(self, mock_settings, mock_webpush):
        mock_settings.VAPID_PRIVATE_KEY = "fake-private-key"
        mock_settings.VAPID_CLAIMS_EMAIL = "mailto:admin@test.cm"
        sub = _make_subscription()

        result = send_push_notification(sub, {"title": "Test", "body": "Hello"})

        assert result is True
        mock_webpush.assert_called_once()
        assert sub.last_error is None

    @patch("app.modules.notifications.push_sender.webpush")
    @patch("app.modules.notifications.push_sender.settings")
    def test_missing_vapid_key(self, mock_settings, mock_webpush):
        mock_settings.VAPID_PRIVATE_KEY = ""
        sub = _make_subscription()

        result = send_push_notification(sub, {"title": "Test"})

        assert result is False
        mock_webpush.assert_not_called()

    @patch("app.modules.notifications.push_sender.webpush")
    @patch("app.modules.notifications.push_sender.settings")
    def test_inactive_subscription(self, mock_settings, mock_webpush):
        mock_settings.VAPID_PRIVATE_KEY = "fake-private-key"
        sub = _make_subscription(is_active=False)

        result = send_push_notification(sub, {"title": "Test"})

        assert result is False
        mock_webpush.assert_not_called()

    @patch("app.modules.notifications.push_sender.webpush")
    @patch("app.modules.notifications.push_sender.settings")
    def test_410_gone_deactivates_subscription(self, mock_settings, mock_webpush):
        mock_settings.VAPID_PRIVATE_KEY = "fake-private-key"
        mock_settings.VAPID_CLAIMS_EMAIL = "mailto:admin@test.cm"
        sub = _make_subscription()

        from pywebpush import WebPushException

        response = SimpleNamespace(status_code=410)
        mock_webpush.side_effect = WebPushException("gone", response=response)

        result = send_push_notification(sub, {"title": "Test"})

        assert result is False
        assert sub.is_active is False
        assert sub.last_error == "410 Gone — subscription expired"
