"""Unit tests for KYC biometric scoring helpers."""

from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

from app.modules.kyc.service import (
    FACE_MATCH_STATUS_ERROR,
    FACE_MATCH_STATUS_FAILED,
    FACE_MATCH_STATUS_NOT_PERFORMED,
    FACE_MATCH_STATUS_PASSED,
    FaceMatchComputation,
    _deepface_verify_if_available,
    compute_anti_spoofing_score_from_landmarks,
    compute_face_match_for_session,
    is_liveness_challenge_passed,
)


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


def test_liveness_challenge_requires_motion():
    static_frames = [_frame(0.5, 0.5) for _ in range(24)]
    dynamic_frames = [_frame(0.40 + i * 0.01, 0.52) for i in range(24)]

    assert is_liveness_challenge_passed(static_frames, "turn_left") is False
    assert is_liveness_challenge_passed(dynamic_frames, "turn_left") is True


def test_deepface_match_pass(monkeypatch):
    class DummyDeepFace:
        @staticmethod
        def verify(**_kwargs):
            return {"distance": 0.10, "verified": True}

    monkeypatch.setitem(
        __import__("sys").modules,
        "deepface",
        SimpleNamespace(DeepFace=DummyDeepFace),
    )

    result = _deepface_verify_if_available(Path("cni.jpg"), Path("selfie.jpg"))

    assert result.status == FACE_MATCH_STATUS_PASSED
    assert result.score == pytest.approx(0.90)
    assert result.detector


def test_deepface_match_fail(monkeypatch):
    class DummyDeepFace:
        @staticmethod
        def verify(**_kwargs):
            return {"distance": 0.35, "verified": False}

    monkeypatch.setitem(
        __import__("sys").modules,
        "deepface",
        SimpleNamespace(DeepFace=DummyDeepFace),
    )

    result = _deepface_verify_if_available(Path("cni.jpg"), Path("selfie.jpg"))

    assert result.status == FACE_MATCH_STATUS_FAILED
    assert result.score == pytest.approx(0.65)
    assert result.reason == "score_below_threshold"


def test_deepface_unavailable(monkeypatch):
    monkeypatch.setitem(__import__("sys").modules, "deepface", ModuleType("deepface"))

    result = _deepface_verify_if_available(Path("cni.jpg"), Path("selfie.jpg"))

    assert result.status == FACE_MATCH_STATUS_ERROR
    assert result.reason == "deepface_unavailable"
    assert result.score is None


@pytest.mark.asyncio
async def test_face_match_missing_selfie_is_not_performed():
    class FakeScalarResult:
        def all(self):
            return [SimpleNamespace(doc_type="CNI_RECTO", file_path="cni.jpg")]

    class FakeResult:
        def scalars(self):
            return FakeScalarResult()

    class FakeDb:
        async def execute(self, _query):
            return FakeResult()

    result = await compute_face_match_for_session(
        session_id=__import__("uuid").uuid4(),
        db=FakeDb(),
    )

    assert result.status == FACE_MATCH_STATUS_NOT_PERFORMED
    assert result.reason == "missing_selfie"


@pytest.mark.asyncio
async def test_face_match_deepface_runs_outside_event_loop(monkeypatch, tmp_path):
    from app.modules.kyc import service as kyc_service

    (tmp_path / "cni.jpg").write_bytes(b"cni")
    (tmp_path / "selfie.jpg").write_bytes(b"selfie")
    monkeypatch.setattr(kyc_service.document_storage, "base_path", tmp_path)

    class FakeScalarResult:
        def all(self):
            return [
                SimpleNamespace(doc_type="CNI_RECTO", file_path="cni.jpg"),
                SimpleNamespace(doc_type="SELFIE", file_path="selfie.jpg"),
            ]

    class FakeResult:
        def scalars(self):
            return FakeScalarResult()

    class FakeDb:
        async def execute(self, _query):
            return FakeResult()

    def fake_deepface(_cni_path, _selfie_path):
        raise AssertionError("DeepFace must be dispatched via asyncio.to_thread")

    called = {"to_thread": False}

    async def fake_to_thread(func, *args):
        called["to_thread"] = True
        assert func is fake_deepface
        assert args == (tmp_path / "cni.jpg", tmp_path / "selfie.jpg")
        return FaceMatchComputation(
            status=FACE_MATCH_STATUS_PASSED,
            reason="score_above_threshold",
            score=0.91,
        )

    monkeypatch.setattr(kyc_service, "_deepface_verify_if_available", fake_deepface)
    monkeypatch.setattr(kyc_service.asyncio, "to_thread", fake_to_thread)

    result = await compute_face_match_for_session(
        session_id=__import__("uuid").uuid4(),
        db=FakeDb(),
    )

    assert called["to_thread"] is True
    assert result.status == FACE_MATCH_STATUS_PASSED
