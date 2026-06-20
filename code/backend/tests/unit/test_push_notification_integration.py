"""Tests for push notification integration in service.py."""

import uuid
from unittest.mock import patch

import pytest

from app.modules.notifications.service import _enqueue_push_notification


class TestEnqueuePushNotification:

    @patch("app.modules.notifications.tasks.send_push_task")
    def test_enqueues_task_with_correct_args(self, mock_task):
        user_id = uuid.uuid4()

        _enqueue_push_notification(
            user_id=user_id,
            notification_type="KYC_APPROVED",
            message="Compte active !",
            payload={"event_key": "abc123"},
        )

        mock_task.delay.assert_called_once()
        args, _ = mock_task.delay.call_args
        assert args[0] == str(user_id)
        assert args[1]["title"] == "Compte active"
        assert args[1]["body"] == "Compte active !"
        assert args[1]["tag"] == "KYC_APPROVED"
        assert args[1]["url"] == "/notifications"
        assert args[1]["data"]["event_key"] == "abc123"

    @patch("app.modules.notifications.tasks.send_push_task")
    def test_handles_exception_gracefully(self, mock_task):
        mock_task.delay.side_effect = RuntimeError("redis down")

        _enqueue_push_notification(
            user_id=uuid.uuid4(),
            notification_type="GENERAL",
            message="Test",
            payload=None,
        )

    @patch("app.modules.notifications.tasks.send_push_task")
    def test_unknown_type_uses_fallback_title(self, mock_task):
        _enqueue_push_notification(
            user_id=uuid.uuid4(),
            notification_type="UNKNOWN_TYPE",
            message="Something happened",
            payload=None,
        )

        mock_task.delay.assert_called_once()
        push_payload = mock_task.delay.call_args.args[1]
        assert push_payload["title"] == "Notification"
