"""Tests pour les endpoints Email OTP (AUTH-01 — fallback email)."""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.core.security import create_access_token


# ============================================================
# HELPERS
# ============================================================

def _auth_header(user_id: str = "test-user-id") -> dict:
    """Génère un header Authorization JWT pour un utilisateur."""
    token = create_access_token(
        subject=user_id,
        additional_claims={"role": "CLIENT", "user_type": "mobile"},
    )
    return {"Authorization": f"Bearer {token}"}


# ============================================================
# TEST EMAIL OTP — SCHÉMAS
# ============================================================

class TestEmailOtpSchemas:
    """Validation Pydantic des schémas Email OTP."""

    def test_email_otp_send_valid(self):
        """Un email valide doit passer la validation."""
        from app.modules.auth.schemas import EmailOtpSendRequest
        req = EmailOtpSendRequest(email="marie@example.com")
        assert req.email == "marie@example.com"

    def test_email_otp_send_invalid(self):
        """Un email invalide doit lever une ValidationError."""
        from app.modules.auth.schemas import EmailOtpSendRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            EmailOtpSendRequest(email="pas-un-email")

    def test_email_otp_verify_valid_otp(self):
        """Un OTP de 6 chiffres doit passer."""
        from app.modules.auth.schemas import EmailOtpVerifyRequest
        req = EmailOtpVerifyRequest(otp="123456")
        assert req.otp == "123456"

    def test_email_otp_verify_otp_too_short(self):
        """Un OTP trop court doit lever une ValidationError."""
        from app.modules.auth.schemas import EmailOtpVerifyRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            EmailOtpVerifyRequest(otp="12345")  # 5 chiffres

    def test_email_otp_verify_otp_non_numeric(self):
        """Un OTP non numérique doit lever une ValidationError."""
        from app.modules.auth.schemas import EmailOtpVerifyRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            EmailOtpVerifyRequest(otp="12345A")


# ============================================================
# TEST EMAIL OTP — ENDPOINT /auth/email/send
# ============================================================

class TestEmailOtpSendEndpoint:
    """Tests de l'endpoint POST /auth/email/send."""

    @pytest.mark.asyncio
    async def test_send_email_otp_without_token_returns_401(self, client: AsyncClient):
        """Sans JWT, l'endpoint doit retourner 401."""
        response = await client.post(
            "/api/v1/auth/email/send",
            json={"email": "marie@example.com"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_send_email_otp_invalid_email_returns_422(self, client: AsyncClient):
        """Un email invalide doit retourner 422."""
        response = await client.post(
            "/api/v1/auth/email/send",
            headers=_auth_header(),
            json={"email": "pas-un-email"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_send_email_otp_success(self, client: AsyncClient):
        """Avec un JWT valide et un email valide, la tâche doit être mise en queue."""
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = None

        with (
            patch("app.modules.auth.router.get_current_user", return_value=mock_user),
            patch("app.modules.auth.router.store_otp", new_callable=AsyncMock, return_value=True),
            patch("app.modules.auth.router.send_only_email_otp_task") as mock_task,
        ):
            mock_task.delay = MagicMock()
            response = await client.post(
                "/api/v1/auth/email/send",
                headers=_auth_header(),
                json={"email": "marie@example.com"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Email OTP" in data["message"] or "email" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_send_email_otp_store_failure_returns_500(self, client: AsyncClient):
        """Si le store Redis échoue, l'endpoint doit retourner 500."""
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = None

        with (
            patch("app.modules.auth.router.get_current_user", return_value=mock_user),
            patch("app.modules.auth.router.store_otp", new_callable=AsyncMock, return_value=False),
        ):
            response = await client.post(
                "/api/v1/auth/email/send",
                headers=_auth_header(),
                json={"email": "marie@example.com"},
            )

        assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_send_email_otp_rate_limiting(self, client: AsyncClient):
        """Vérifie que l'envoi répété d'OTP déclenche le rate limit (429)."""
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.email = None

        with (
            patch("app.modules.auth.router.get_current_user", return_value=mock_user),
            patch("app.modules.auth.router.store_otp", new_callable=AsyncMock, return_value=True),
            patch("app.modules.auth.router.send_only_email_otp_task") as mock_task,
        ):
            mock_task.delay = MagicMock()
            
            # Paramètres de test : RATE_LIMIT_OTP="3/minute"
            # On envoie 3 requêtes (OK)
            for _ in range(3):
                req = await client.post(
                    "/api/v1/auth/email/send",
                    headers=_auth_header(),
                    json={"email": "marie@example.com"},
                )
                assert req.status_code == 200
                
            # La 4ème doit être bloquée (429 Too Many Requests)
            req4 = await client.post(
                "/api/v1/auth/email/send",
                headers=_auth_header(),
                json={"email": "marie@example.com"},
            )
            assert req4.status_code == 429


# ============================================================
# TEST EMAIL OTP — ENDPOINT /auth/email/verify
# ============================================================

class TestEmailOtpVerifyEndpoint:
    """Tests de l'endpoint POST /auth/email/verify."""

    @pytest.mark.asyncio
    async def test_verify_email_otp_without_token_returns_401(self, client: AsyncClient):
        """Sans JWT, l'endpoint doit retourner 401."""
        response = await client.post(
            "/api/v1/auth/email/verify",
            json={"otp": "123456"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_email_otp_invalid_otp_returns_422(self, client: AsyncClient):
        """Un OTP invalide (non numérique) doit retourner 422."""
        response = await client.post(
            "/api/v1/auth/email/verify",
            headers=_auth_header(),
            json={"otp": "abcdef"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_verify_email_otp_no_email_on_user_returns_400(self, client: AsyncClient):
        """Si l'utilisateur n'a pas d'email enregistré, retourner 400."""
        mock_user = MagicMock()
        mock_user.email = None  # Pas d'email

        with patch("app.modules.auth.router.get_current_user", return_value=mock_user):
            response = await client.post(
                "/api/v1/auth/email/verify",
                headers=_auth_header(),
                json={"otp": "123456"},
            )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_verify_email_otp_wrong_otp_returns_401(self, client: AsyncClient):
        """Un OTP incorrect doit retourner 401."""
        mock_user = MagicMock()
        mock_user.email = "marie@example.com"

        with (
            patch("app.modules.auth.router.get_current_user", return_value=mock_user),
            patch("app.modules.auth.router.verify_otp", new_callable=AsyncMock, return_value=False),
        ):
            response = await client.post(
                "/api/v1/auth/email/verify",
                headers=_auth_header(),
                json={"otp": "000000"},
            )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_email_otp_correct_otp_returns_200(self, client: AsyncClient):
        """Un OTP correct doit retourner 200 avec un message de succès."""
        mock_user = MagicMock()
        mock_user.email = "marie@example.com"

        with (
            patch("app.modules.auth.router.get_current_user", return_value=mock_user),
            patch("app.modules.auth.router.verify_otp", new_callable=AsyncMock, return_value=True),
            patch("app.modules.auth.router.delete_otp", new_callable=AsyncMock),
        ):
            response = await client.post(
                "/api/v1/auth/email/verify",
                headers=_auth_header(),
                json={"otp": "123456"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data


# ============================================================
# TEST EMAIL TASK — _send_only_email_flow
# ============================================================

class TestEmailOtpTask:
    """Tests unitaires de la logique de la tâche Celery email-only."""

    @pytest.mark.asyncio
    async def test_dev_local_mode_returns_true_without_sending(self):
        """En mode dev_local, la tâche doit retourner True sans envoyer d'email."""
        from app.modules.auth.tasks import _send_only_email_flow
        with patch("app.modules.auth.tasks.settings") as mock_settings:
            mock_settings.OTP_MODE = "dev_local"
            mock_settings.OTP_EXPIRY_MINUTES = 5
            result = await _send_only_email_flow("marie@example.com", "123456")
        assert result is True

    @pytest.mark.asyncio
    async def test_email_mode_calls_email_client(self):
        """En mode email, la tâche doit appeler email_client.send_email."""
        from app.modules.auth.tasks import _send_only_email_flow
        with (
            patch("app.modules.auth.tasks.settings") as mock_settings,
            patch("app.modules.auth.tasks.email_client") as mock_email,
        ):
            mock_settings.OTP_MODE = "email"
            mock_settings.OTP_EXPIRY_MINUTES = 5
            mock_email.send_email = AsyncMock(return_value=True)

            result = await _send_only_email_flow("marie@example.com", "123456")

        assert result is True
        mock_email.send_email.assert_called_once()
        # Vérifie que le bon destinataire a été utilisé
        call_kwargs = mock_email.send_email.call_args
        assert "marie@example.com" in str(call_kwargs)

    @pytest.mark.asyncio
    async def test_email_failure_returns_false(self):
        """Si l'email échoue, la tâche doit retourner False."""
        from app.modules.auth.tasks import _send_only_email_flow
        with (
            patch("app.modules.auth.tasks.settings") as mock_settings,
            patch("app.modules.auth.tasks.email_client") as mock_email,
        ):
            mock_settings.OTP_MODE = "email"
            mock_settings.OTP_EXPIRY_MINUTES = 5
            mock_email.send_email = AsyncMock(return_value=False)

            result = await _send_only_email_flow("marie@example.com", "654321")

        assert result is False

    @pytest.mark.asyncio
    async def test_fallback_to_email_on_sms_failure(self):
        """Tester que si l'envoi SMS échoue, on fallback sur l'email si OTP_FALLBACK_EMAIL=True."""
        from app.modules.auth.tasks import _send_otp_flow
        with (
            patch("app.modules.auth.tasks.settings") as mock_settings,
            patch("app.modules.auth.tasks.sms_client") as mock_sms,
            patch("app.modules.auth.tasks.email_client") as mock_email,
        ):
            mock_settings.OTP_MODE = "orange"
            mock_settings.ENVIRONMENT = "production"
            mock_settings.OTP_FALLBACK_EMAIL = True
            mock_settings.OTP_EXPIRY_MINUTES = 5
            
            mock_sms.send_sms = AsyncMock(return_value=False)
            mock_email.send_email = AsyncMock(return_value=True)

            result = await _send_otp_flow("237600000000", "123456", "fallback@example.com")

        assert result is True
        mock_sms.send_sms.assert_called_once()
        mock_email.send_email.assert_called_once()
