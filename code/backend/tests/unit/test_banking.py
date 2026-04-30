"""Unit tests for banking module — ISO 20022 service and schemas."""

import pytest
from app.services.iso20022_service import build_pacs_008


class TestIso20022Service:
    """Tests for ISO 20022 pacs.008 XML generation."""

    def test_build_pacs_008_basic(self):
        result = build_pacs_008(
            debtor_name="Test User",
            debtor_iban="CM2110001000231234567890142",
            creditor_name="Recipient",
            creditor_iban="CM2110001000239876543210142",
            amount=25000.00,
        )
        assert result["msg_id"].startswith("MSG-")
        assert result["end_to_end_id"].startswith("E2E-")
        assert result["instr_id"].startswith("INSTR-")
        assert result["scheme"] == "XAF-RTGS"
        assert "Test User" in result["xml"]
        assert "Recipient" in result["xml"]
        assert "25000.00" in result["xml"]
        assert "XAF" in result["xml"]

    def test_build_pacs_008_with_bic(self):
        result = build_pacs_008(
            debtor_name="Debtor",
            debtor_iban="CM2110001000231234567890142",
            debtor_bic="BICECMCX",
            creditor_name="Creditor",
            creditor_iban="CM2110001000239876543210142",
            creditor_bic="BICECMCX",
            amount=1000.00,
        )
        assert "BICECMCX" in result["xml"]
        assert "<DbtrAgt>" in result["xml"]
        assert "<CdtrAgt>" in result["xml"]

    def test_build_pacs_008_with_remitance(self):
        result = build_pacs_008(
            debtor_name="Debtor",
            debtor_iban="CM2110001000231234567890142",
            creditor_name="Creditor",
            creditor_iban="CM2110001000239876543210142",
            amount=5000.00,
            remittance="Paiement loyer janvier",
        )
        assert "Paiement loyer janvier" in result["xml"]
        assert "<RmtInf>" in result["xml"]

    def test_build_pacs_008_mobile_scheme(self):
        result = build_pacs_008(
            debtor_name="Debtor",
            debtor_iban="CM2110001000231234567890142",
            creditor_name="Creditor",
            creditor_iban="CM00MOBILE000000000000000000",
            amount=2000.00,
            scheme="MOBILE",
        )
        assert result["scheme"] == "MOBILE"

    def test_build_pacs_008_xml_structure(self):
        result = build_pacs_008(
            debtor_name="Test",
            debtor_iban="CM2110001000231234567890142",
            creditor_name="Test",
            creditor_iban="CM2110001000239876543210142",
            amount=100.00,
        )
        xml = result["xml"]
        assert xml.startswith('<?xml version="1.0"')
        assert "pacs.008.001.10" in xml
        assert "<GrpHdr>" in xml
        assert "<CdtTrfTxInf>" in xml
        assert "<NbOfTxs>1</NbOfTxs>" in xml

    def test_build_pacs_008_escapes_xml(self):
        result = build_pacs_008(
            debtor_name="Test & Co",
            debtor_iban="CM2110001000231234567890142",
            creditor_name='Creditor "Inc"',
            creditor_iban="CM2110001000239876543210142",
            amount=100.00,
            remittance="Test <script>",
        )
        assert "&amp;" in result["xml"]
        assert "&quot;" in result["xml"]
        assert "&lt;" in result["xml"]


from app.modules.banking.schemas import (
    TransferSendRequest,
    CardFreezeRequest,
    SavingsPocketCreate,
)


class TestBankingSchemas:
    """Tests for Pydantic schema validation."""

    def test_transfer_send_request_valid(self):
        req = TransferSendRequest(
            transfer_type="bicec",
            amount=25000,
            creditor_name="John Doe",
            creditor_iban="CM2110001000239876543210142",
        )
        assert req.transfer_type == "bicec"
        assert req.amount == 25000
        assert req.currency == "XAF"

    def test_transfer_send_request_mobile(self):
        req = TransferSendRequest(
            transfer_type="mobile",
            amount=5000,
            creditor_name="Jane Doe",
            creditor_phone="699000000",
        )
        assert req.transfer_type == "mobile"

    def test_card_freeze_request(self):
        req = CardFreezeRequest(frozen=True)
        assert req.frozen is True

    def test_savings_pocket_create(self):
        pocket = SavingsPocketCreate(
            name="Voyage",
            goal=200000,
            initial_amount=50000,
            color="bg-amber-500",
            icon="✈️",
        )
        assert pocket.name == "Voyage"
        assert pocket.goal == 200000
        assert pocket.initial_amount == 50000
