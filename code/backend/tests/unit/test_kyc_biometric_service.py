"""Unit tests for KYC biometric scoring helpers."""

from app.modules.kyc.service import compute_anti_spoofing_score_from_landmarks


def _frame(x: float, y: float) -> dict:
    return {"landmarks": [{"x": 0.0, "y": 0.0}, {"x": x, "y": y}]}


def test_anti_spoofing_returns_zero_without_landmarks():
    score = compute_anti_spoofing_score_from_landmarks([], "blink")
    assert score == 0.0


def test_anti_spoofing_improves_with_more_frames_and_motion():
    static_frames = [_frame(0.5, 0.5) for _ in range(4)]
    dynamic_frames = [_frame(0.48 + i * 0.01, 0.52 - i * 0.006) for i in range(24)]

    low_score = compute_anti_spoofing_score_from_landmarks(static_frames, "blink")
    high_score = compute_anti_spoofing_score_from_landmarks(dynamic_frames, "turn_left")

    assert 0.0 <= low_score <= 1.0
    assert 0.0 <= high_score <= 1.0
    assert high_score > low_score
