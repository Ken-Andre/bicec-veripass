"""Tests for EmailClient — kwargs mapping, TLS semantics, mailpit and production SMTP."""

import pytest
from unittest.mock import AsyncMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_client(
    host="smtp.example.com",
    port=587,
    user="",
    password="",
    smtp_tls=False,
    smtp_ssl=False,
    environment="production",
):
    """Return an EmailClient whose attributes are set directly (bypasses settings)."""
    from app.core.email import EmailClient

    # Patch settings only during __init__ so the instance is constructed cleanly
    with patch("app.core.email.settings") as ms:
        ms.SMTP_HOST = host
        ms.SMTP_PORT = port
        ms.SMTP_USER = user
        ms.SMTP_PASSWORD = password
        ms.SMTP_TLS = smtp_tls
        ms.SMTP_SSL = smtp_ssl
        ms.SMTP_FROM = "noreply@test.cm"
        ms.ENVIRONMENT = environment
        client = EmailClient()

    return client


async def _send(client, environment="production"):
    """Call send_email with settings.ENVIRONMENT patched."""
    with (
        patch("app.core.email.settings") as ms,
        patch("aiosmtplib.send", new_callable=AsyncMock) as mock_send,
    ):
        ms.ENVIRONMENT = environment
        mock_send.return_value = ({}, "OK")
        result = await client.send_email("dest@example.com", "Subj", "Body")
    return result, mock_send


# ---------------------------------------------------------------------------
# Unit tests — kwargs mapping
# ---------------------------------------------------------------------------


class TestEmailClientKwargsMapping:
    """Verify that aiosmtplib.send() receives the correct kwargs."""

    @pytest.mark.asyncio
    async def test_no_auth_passes_none_for_username_and_password(self):
        """Empty user/password must be passed as None, not omitted."""
        client = _make_client(user="", password="")
        _, mock_send = await _send(client)

        _, kwargs = mock_send.call_args
        assert kwargs["username"] is None
        assert kwargs["password"] is None

    @pytest.mark.asyncio
    async def test_auth_passes_credentials_explicitly(self):
        """Non-empty user/password must be forwarded as-is."""
        client = _make_client(user="user@smtp.cm", password="s3cr3t")
        _, mock_send = await _send(client)

        _, kwargs = mock_send.call_args
        assert kwargs["username"] == "user@smtp.cm"
        assert kwargs["password"] == "s3cr3t"

    @pytest.mark.asyncio
    async def test_smtp_ssl_maps_to_use_tls_true(self):
        """SMTP_SSL=True → use_tls=True (implicit TLS, port 465)."""
        client = _make_client(smtp_ssl=True, smtp_tls=False)
        _, mock_send = await _send(client)

        _, kwargs = mock_send.call_args
        assert kwargs["use_tls"] is True
        assert kwargs["start_tls"] is False

    @pytest.mark.asyncio
    async def test_smtp_tls_maps_to_start_tls_true(self):
        """SMTP_TLS=True → start_tls=True (STARTTLS upgrade, port 587)."""
        client = _make_client(smtp_tls=True, smtp_ssl=False)
        _, mock_send = await _send(client)

        _, kwargs = mock_send.call_args
        assert kwargs["start_tls"] is True
        assert kwargs["use_tls"] is False

    @pytest.mark.asyncio
    async def test_no_tls_both_false(self):
        """Plain SMTP (mailpit): both use_tls and start_tls must be False."""
        client = _make_client(smtp_tls=False, smtp_ssl=False)
        _, mock_send = await _send(client)

        _, kwargs = mock_send.call_args
        assert kwargs["use_tls"] is False
        assert kwargs["start_tls"] is False

    @pytest.mark.asyncio
    async def test_hostname_and_port_forwarded(self):
        """hostname and port must be passed through unchanged."""
        client = _make_client(host="mail.bicec.cm", port=465)
        _, mock_send = await _send(client)

        _, kwargs = mock_send.call_args
        assert kwargs["hostname"] == "mail.bicec.cm"
        assert kwargs["port"] == 465


# ---------------------------------------------------------------------------
# Unit tests — mutual exclusion guard
# ---------------------------------------------------------------------------


class TestTlsMutualExclusion:
    """use_tls and start_tls must never both be True."""

    @pytest.mark.asyncio
    async def test_both_tls_flags_raises_value_error(self):
        """Setting SMTP_TLS=True and SMTP_SSL=True must raise ValueError."""
        client = _make_client(smtp_tls=True, smtp_ssl=True)

        with patch("app.core.email.settings") as ms:
            ms.ENVIRONMENT = "production"
            with pytest.raises(ValueError, match="mutually exclusive"):
                await client.send_email("dest@example.com", "Subj", "Body")


# ---------------------------------------------------------------------------
# Unit tests — dev simulation shortcut
# ---------------------------------------------------------------------------


class TestDevSimulationShortcut:
    """In non-production with no user and host=localhost, skip real send."""

    @pytest.mark.asyncio
    async def test_dev_local_returns_true_without_calling_aiosmtplib(self):
        client = _make_client(host="localhost", user="", environment="development")

        with (
            patch("app.core.email.settings") as ms,
            patch("aiosmtplib.send", new_callable=AsyncMock) as mock_send,
        ):
            ms.ENVIRONMENT = "development"
            result = await client.send_email("dest@example.com", "Subj", "Body")

        assert result is True
        mock_send.assert_not_called()


# ---------------------------------------------------------------------------
# Integration tests — mailpit (plain SMTP, no auth, port 1025)
# ---------------------------------------------------------------------------


class TestMailpitIntegration:
    """
    Live tests against mailpit (http://localhost:8025).
    Skipped automatically when mailpit is not reachable on port 1025.
    """

    @pytest.fixture(autouse=True)
    def skip_if_no_mailpit(self):
        import socket

        try:
            s = socket.create_connection(("localhost", 1025), timeout=1)
            s.close()
        except OSError:
            pytest.skip("mailpit not reachable on localhost:1025")

    @pytest.mark.asyncio
    async def test_send_plain_smtp_no_auth(self):
        """Plain SMTP to mailpit — no TLS, no auth."""
        client = _make_client(
            host="localhost",
            port=1025,
            user="",
            password="",
            smtp_tls=False,
            smtp_ssl=False,
        )
        with patch("app.core.email.settings") as ms:
            ms.ENVIRONMENT = "production"
            result = await client.send_email(
                "recipient@example.com",
                "Mailpit integration test",
                "Hello from test suite",
            )
        assert result is True

    @pytest.mark.asyncio
    async def test_send_html_content(self):
        """HTML email to mailpit."""
        client = _make_client(
            host="localhost",
            port=1025,
            user="",
            password="",
            smtp_tls=False,
            smtp_ssl=False,
        )
        with patch("app.core.email.settings") as ms:
            ms.ENVIRONMENT = "production"
            result = await client.send_email(
                "recipient@example.com",
                "HTML test",
                "<h1>Hello</h1>",
                content_type="html",
            )
        assert result is True


# ---------------------------------------------------------------------------
# Integration tests — production SMTP (STARTTLS, port 587)
# ---------------------------------------------------------------------------


class TestProductionSmtpIntegration:
    """
    Live tests against a real SMTP relay.
    Requires env vars: TEST_SMTP_HOST, TEST_SMTP_PORT, TEST_SMTP_USER,
    TEST_SMTP_PASSWORD, TEST_SMTP_TO.
    Skipped when those vars are absent.
    """

    @pytest.fixture(autouse=True)
    def smtp_env(self):
        import os

        required = [
            "TEST_SMTP_HOST",
            "TEST_SMTP_PORT",
            "TEST_SMTP_USER",
            "TEST_SMTP_PASSWORD",
            "TEST_SMTP_TO",
        ]
        missing = [k for k in required if not os.environ.get(k)]
        if missing:
            pytest.skip(f"Missing env vars for production SMTP: {missing}")

        self.host = os.environ["TEST_SMTP_HOST"]
        self.port = int(os.environ["TEST_SMTP_PORT"])
        self.user = os.environ["TEST_SMTP_USER"]
        self.password = os.environ["TEST_SMTP_PASSWORD"]
        self.to_email = os.environ["TEST_SMTP_TO"]

    @pytest.mark.asyncio
    async def test_starttls_send(self):
        """STARTTLS (SMTP_TLS=True) against a real relay."""
        client = _make_client(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            smtp_tls=True,
            smtp_ssl=False,
        )
        with patch("app.core.email.settings") as ms:
            ms.ENVIRONMENT = "production"
            result = await client.send_email(
                self.to_email,
                "VeriPass STARTTLS integration test",
                "Sent via STARTTLS from the test suite.",
            )
        assert result is True

    @pytest.mark.asyncio
    async def test_implicit_ssl_send(self):
        """Implicit TLS/SSL (SMTP_SSL=True, port 465) against a real relay."""
        import os

        ssl_port = int(os.environ.get("TEST_SMTP_SSL_PORT", 465))

        client = _make_client(
            host=self.host,
            port=ssl_port,
            user=self.user,
            password=self.password,
            smtp_tls=False,
            smtp_ssl=True,
        )
        with patch("app.core.email.settings") as ms:
            ms.ENVIRONMENT = "production"
            result = await client.send_email(
                self.to_email,
                "VeriPass implicit-TLS integration test",
                "Sent via implicit TLS from the test suite.",
            )
        assert result is True
