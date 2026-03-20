"""Tests unitaires pour le module Auth (Issue #50 — AUTH-04)."""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token


# ============================================================
# TESTS SECURITY UTILITIES (pure functions — no DB needed)
# ============================================================

class TestSecurityUtilities:
    """Tests pour les fonctions de sécurité (hashing, JWT)."""

    def test_hash_password_returns_hash(self):
        """Le hash d'un mot de passe ne doit jamais être le mot de passe lui-même."""
        password = "TestPassword123"
        hashed = hash_password(password)
        assert hashed != password
        assert len(hashed) > 20  # bcrypt hashes are ~60 chars

    def test_verify_password_correct(self):
        """Un mot de passe correct doit être vérifié avec succès."""
        password = "MySecurePass456"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Un mot de passe incorrect doit échouer la vérification."""
        password = "CorrectPassword"
        wrong_password = "WrongPassword"
        hashed = hash_password(password)
        assert verify_password(wrong_password, hashed) is False

    def test_create_access_token_contains_subject(self):
        """Le token d'accès doit contenir le sujet (user ID)."""
        token = create_access_token(subject="user-123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"

    def test_create_access_token_with_claims(self):
        """Le token doit contenir les claims additionnels."""
        token = create_access_token(
            subject="agent-456",
            additional_claims={"role": "JEAN", "user_type": "agent"},
        )
        payload = decode_token(token)
        assert payload["role"] == "JEAN"
        assert payload["user_type"] == "agent"

    def test_create_refresh_token_type(self):
        """Le refresh token doit avoir type=refresh."""
        token = create_refresh_token(subject="user-789")
        payload = decode_token(token)
        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-789"

    def test_decode_invalid_token(self):
        """Un token invalide doit retourner None."""
        result = decode_token("invalid.token.here")
        assert result is None

    def test_decode_tampered_token(self):
        """Un token modifié doit retourner None."""
        token = create_access_token(subject="user-123")
        tampered = token[:-5] + "XXXXX"
        result = decode_token(tampered)
        assert result is None


# ============================================================
# TESTS API ENDPOINTS (sans DB — mocks)
# ============================================================

class TestAuthEndpointsNoDB:
    """Tests des endpoints auth sans dépendance DB (mocks)."""

    @pytest.mark.asyncio
    async def test_send_otp_dev_local(self, client: AsyncClient):
        """En mode dev_local, l'OTP doit être retourné dans la réponse."""
        with patch("app.modules.auth.router.store_otp", new_callable=AsyncMock, return_value=True):
            response = await client.post(
                "/api/v1/auth/otp/send",
                json={"phone": "+237612345678"},
            )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    @pytest.mark.asyncio
    async def test_send_otp_invalid_phone(self, client: AsyncClient):
        """Un numéro invalide doit retourner 422."""
        response = await client.post(
            "/api/v1/auth/otp/send",
            json={"phone": "123"},  # invalide
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_verify_otp_invalid(self, client: AsyncClient):
        """Un OTP invalide doit retourner 401."""
        with patch("app.modules.auth.router.verify_otp", new_callable=AsyncMock, return_value=False):
            response = await client.post(
                "/api/v1/auth/otp/verify",
                json={"phone": "+237612345678", "otp": "000000"},
            )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_agent_login_invalid_email(self, client: AsyncClient):
        """Un email invalide doit retourner 422."""
        response = await client.post(
            "/api/v1/auth/agent/login",
            json={"email": "not-an-email", "password": "password123"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_agent_login_wrong_credentials(self, client: AsyncClient):
        """Des identifiants incorrects doivent retourner 401."""
        with patch("app.modules.auth.router.verify_password", return_value=False):
            response = await client.post(
                "/api/v1/auth/agent/login",
                json={"email": "jean@bicec.cm", "password": "wrongpassword"},
            )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client: AsyncClient):
        """Un refresh token invalide doit retourner 401."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_without_token(self, client: AsyncClient):
        """Accéder à /me sans token doit retourner 401 ou 403."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_agent_me_without_token(self, client: AsyncClient):
        """Accéder à /agent/me sans token doit retourner 401 ou 403."""
        response = await client.get("/api/v1/auth/agent/me")
        assert response.status_code in (401, 403)

    @pytest.mark.asyncio
    async def test_pin_verify_missing_user(self, client: AsyncClient):
        """Vérifier un PIN pour un utilisateur inexistant doit retourner 401."""
        response = await client.post(
            "/api/v1/auth/pin/verify",
            json={"phone": "+237000000000", "pin": "1234"},
        )
        assert response.status_code == 401


# ============================================================
# TESTS SCHÉMAS PYDANTIC
# ============================================================

class TestAuthSchemas:
    """Tests de validation des schémas Pydantic."""

    def test_token_response_valid(self):
        """Un TokenResponse valide doit se construire."""
        from app.modules.auth.schemas import TokenResponse
        token = TokenResponse(
            access_token="abc123",
            refresh_token="def456",
            expires_in=3600,
        )
        assert token.token_type == "bearer"

    def test_otp_send_valid_phone(self):
        """Un numéro valide doit passer la validation."""
        from app.modules.auth.schemas import OtpSendRequest
        req = OtpSendRequest(phone="+237612345678")
        assert req.phone == "+237612345678"

    def test_otp_send_invalid_phone(self):
        """Un numéro invalide doit lever une erreur."""
        from app.modules.auth.schemas import OtpSendRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            OtpSendRequest(phone="abc")

    def test_pin_setup_valid(self):
        """Un PIN valide doit passer la validation."""
        from app.modules.auth.schemas import PinSetupRequest
        req = PinSetupRequest(pin="1234")
        assert req.pin == "1234"

    def test_pin_setup_too_short(self):
        """Un PIN trop court doit lever une erreur."""
        from app.modules.auth.schemas import PinSetupRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            PinSetupRequest(pin="12")  # min_length=4

    def test_agent_login_valid(self):
        """Un login agent valide doit passer la validation."""
        from app.modules.auth.schemas import AgentLoginRequest
        req = AgentLoginRequest(email="jean@bicec.cm", password="password123")
        assert req.email == "jean@bicec.cm"