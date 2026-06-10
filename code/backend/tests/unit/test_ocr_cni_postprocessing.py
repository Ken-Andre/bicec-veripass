from app.services.ocr_service import (
    CNI_FIELDS,
    _apply_cni_postprocessing,
    _is_contextual_address_text,
    _validate_field_value,
)


def _empty_cni_fields() -> dict:
    data = {field: {"value": None, "conf": 0.0} for field in CNI_FIELDS}
    data["methode"] = "TEMPLATE_POSITIONNEL"
    data["detected_side"] = "verso"
    return data


def test_expiry_high_confidence_derives_issue_date() -> None:
    data = _empty_cni_fields()
    data["date_expiration"] = {"value": "19.06.2034", "conf": 0.97}

    _apply_cni_postprocessing(data)

    assert data["date_delivrance"] == {"value": "19.06.2024", "conf": 0.96}
    assert "POSTPROC_DATE_10Y" in data["methode"]


def test_issue_high_confidence_derives_expiry_date() -> None:
    data = _empty_cni_fields()
    data["date_delivrance"] = {"value": "01/03/2024", "conf": 0.94}

    _apply_cni_postprocessing(data)

    assert data["date_expiration"] == {"value": "01/03/2034", "conf": 0.94}


def test_low_confidence_source_date_does_not_derive_pair() -> None:
    data = _empty_cni_fields()
    data["date_expiration"] = {"value": "19.06.2034", "conf": 0.89}

    _apply_cni_postprocessing(data)

    assert data["date_delivrance"]["value"] is None
    assert "POSTPROC_DATE_10Y" not in data["methode"]


def test_high_confidence_valid_target_date_is_not_overwritten() -> None:
    data = _empty_cni_fields()
    data["date_expiration"] = {"value": "19.06.2034", "conf": 0.97}
    data["date_delivrance"] = {"value": "18.06.2024", "conf": 0.95}

    _apply_cni_postprocessing(data)

    assert data["date_delivrance"] == {"value": "18.06.2024", "conf": 0.95}


def test_leap_day_derivation_falls_back_to_february_28() -> None:
    data = _empty_cni_fields()
    data["date_delivrance"] = {"value": "29.02.2024", "conf": 0.95}

    _apply_cni_postprocessing(data)

    assert data["date_expiration"] == {"value": "28.02.2034", "conf": 0.95}


def test_alphabetic_address_requires_strong_context() -> None:
    data = _empty_cni_fields()
    blocks = [{"text": "GAROUA", "cx": 110, "cy": 730, "conf": 0.91}]

    _apply_cni_postprocessing(
        data,
        blocks=blocks,
        img_height=1000,
        img_width=1000,
        detected_side="verso",
    )

    assert data["adresse"]["value"] == "GAROUA"
    assert data["adresse"]["address_context"] == "zone"
    assert _validate_field_value("adresse", "GAROUA") is None


def test_contextual_address_rejects_other_verso_field_formats() -> None:
    assert not _is_contextual_address_text("965496")
    assert not _is_contextual_address_text("20242523751060686")
    assert not _is_contextual_address_text("ES40")
    assert not _is_contextual_address_text("19.06.2034")


def test_sp_nin_poste_and_dates_remain_distinct() -> None:
    data = _empty_cni_fields()
    data["sp"] = {"value": "965496", "conf": 0.96}
    data["numero_cni"] = {"value": "20242523751060686", "conf": 0.96}
    data["poste_identification"] = {"value": "ES 40", "conf": 0.96}
    data["date_delivrance"] = {"value": "19.06.2024", "conf": 0.96}

    _apply_cni_postprocessing(data)

    assert data["sp"]["value"] == "965496"
    assert data["numero_cni"]["value"] == "20242523751060686"
    assert data["poste_identification"]["value"] == "ES40"
    assert data["date_delivrance"]["value"] == "19.06.2024"
    assert data["date_expiration"]["value"] == "19.06.2034"
