import pytest

from app.modules.analytics.service import BASELINE_REQUIRED, calculate_business_case_metrics


def test_business_case_requires_baseline_for_financial_metrics():
    actual = {
        "started_count": 10,
        "submitted_count": 5,
        "approved_count": 3,
        "approved_without_info_count": 2,
        "abandoned_count": 1,
        "info_requested_sessions": 1,
        "resubmitted_count": 1,
        "ocr_fields_count": 20,
        "ocr_corrected_count": 4,
        "decision_count": 5,
        "late_decisions_count": 1,
    }

    result = calculate_business_case_metrics(None, actual)

    assert result["baseline_required"] is True
    assert result["network_quality"]["first_time_right_rate"]["raw"] == pytest.approx(0.4)
    assert result["network_quality"]["complement_request_rate"]["raw"] == pytest.approx(0.2)
    assert result["finance"]["current_cost_per_dossier"]["display"] == BASELINE_REQUIRED
    assert result["finance"]["roi_percent"]["display"] == BASELINE_REQUIRED


def test_business_case_calculates_roi_and_costs():
    baseline = {
        "monthly_kyc_volume": 100,
        "current_branch_minutes_per_dossier": 10,
        "current_backoffice_minutes_per_dossier": 20,
        "current_incomplete_rate": 0.2,
        "current_abandonment_rate": 0.2,
        "hourly_staff_cost_xaf": 6000,
        "avg_customer_12m_value_xaf": 10000,
        "audit_requests_per_period": 2,
        "current_audit_assembly_hours": 5,
        "veripass_audit_export_hours": 1,
        "average_rework_cost_xaf": 1000,
        "pilot_setup_cost_xaf": 100000,
        "pilot_monthly_run_cost_xaf": 50000,
        "pilot_duration_months": 2,
    }
    actual = {
        "started_count": 100,
        "submitted_count": 80,
        "approved_count": 70,
        "approved_without_info_count": 64,
        "abandoned_count": 10,
        "info_requested_sessions": 8,
        "resubmitted_count": 4,
        "ocr_fields_count": 100,
        "ocr_corrected_count": 20,
        "avg_review_duration_ms": 600000,
        "decision_count": 80,
        "late_decisions_count": 8,
    }

    result = calculate_business_case_metrics(baseline, actual)

    assert result["baseline_required"] is False
    assert result["network_quality"]["first_time_right_rate"]["raw"] == pytest.approx(0.8)
    assert result["network_quality"]["complement_request_rate"]["raw"] == pytest.approx(0.1)
    assert result["finance"]["current_cost_per_dossier"]["raw"] == pytest.approx(3000)
    assert result["finance"]["veripass_cost_per_dossier"]["raw"] == pytest.approx(1625)
    assert result["finance"]["operational_savings_monthly"]["raw"] == pytest.approx(110000)
    assert result["finance"]["compliance_gain_monthly"]["raw"] == pytest.approx(58000)
    assert result["finance"]["pilot_cost"]["raw"] == pytest.approx(400000)
    assert result["finance"]["pilot_gain"]["raw"] == pytest.approx(336000)
    assert result["finance"]["roi_percent"]["raw"] == pytest.approx(-16)


def test_business_case_handles_zero_denominators():
    baseline = {
        "monthly_kyc_volume": 0,
        "hourly_staff_cost_xaf": 0,
        "pilot_setup_cost_xaf": 0,
        "pilot_monthly_run_cost_xaf": 0,
        "pilot_duration_months": 1,
    }
    actual = {
        "started_count": 0,
        "submitted_count": 0,
        "approved_count": 0,
        "approved_without_info_count": 0,
        "abandoned_count": 0,
        "info_requested_sessions": 0,
        "resubmitted_count": 0,
        "ocr_fields_count": 0,
        "ocr_corrected_count": 0,
        "decision_count": 0,
        "late_decisions_count": 0,
    }

    result = calculate_business_case_metrics(baseline, actual)

    assert result["baseline_required"] is False
    assert result["network_quality"]["first_time_right_rate"]["raw"] == 0
    assert result["operations"]["sla_respected_rate"]["raw"] == 0
    assert result["finance"]["roi_percent"]["raw"] is None
    assert result["finance"]["roi_percent"]["display"] == "N/A"
