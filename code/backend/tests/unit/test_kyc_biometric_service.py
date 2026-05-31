"""Unit tests for KYC biometric scoring helpers."""

from pathlib import Path
from types import ModuleType, SimpleNamespace

import numpy as np
import pytest
from PIL import Image

from app.core.config import settings
from app.modules.kyc.service import (
    FACE_MATCH_STATUS_ERROR,
    FACE_MATCH_STATUS_FAILED,
    FACE_MATCH_STATUS_NOT_PERFORMED,
    FACE_MATCH_STATUS_PASSED,
    MINIFASNET_STATUS_ERROR,
    MINIFASNET_STATUS_FAILED,
    MINIFASNET_STATUS_NOT_PERFORMED,
    MINIFASNET_STATUS_PASSED,
    FaceMatchComputation,
    _deepface_verify_if_available,
    _minifasnet_verify_if_available,
    compute_anti_spoofing_score_from_landmarks,
    compute_face_match_for_session,
    compute_minifasnet_for_session,
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


def _write_selfie(path: Path) -> None:
    image = np.full((120, 120, 3), 160, dtype=np.uint8)
    Image.fromarray(image).save(path)


def _install_minifasnet_fakes(monkeypatch, logits, *, faces=None):
    from app.modules.kyc import service as kyc_service

    class DummyInput:
        name = "input"
        shape = [1, 3, 80, 80]

    class DummyOutput:
        name = "output"

    class DummySession:
        def __init__(self, *_args, **_kwargs):
            pass

        def get_inputs(self):
            return [DummyInput()]

        def get_outputs(self):
            return [DummyOutput()]

        def run(self, _outputs, _inputs):
            return [np.array(logits, dtype=np.float32)]

    class DummyDeepFace:
        @staticmethod
        def extract_faces(**_kwargs):
            if faces is not None:
                return faces
            return [{"facial_area": {"x": 20, "y": 20, "w": 60, "h": 60}}]

    monkeypatch.setitem(
        __import__("sys").modules,
        "onnxruntime",
        SimpleNamespace(InferenceSession=DummySession),
    )
    monkeypatch.setitem(
        __import__("sys").modules,
        "deepface",
        SimpleNamespace(DeepFace=DummyDeepFace),
    )
    monkeypatch.setattr(kyc_service, "_shared_minifasnet_session", None)
    monkeypatch.setattr(kyc_service, "_shared_minifasnet_model_path", None)


def test_minifasnet_model_missing_returns_error(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "MINIFASNET_ENABLED", True)
    monkeypatch.setattr(settings, "MINIFASNET_MODEL_PATH", str(tmp_path / "missing.onnx"))

    result = _minifasnet_verify_if_available(tmp_path / "selfie.jpg")

    assert result.status == MINIFASNET_STATUS_ERROR
    assert result.reason == "minifasnet_model_missing"


def test_minifasnet_live_score_passes(monkeypatch, tmp_path):
    model_path = tmp_path / "MiniFASNetV2.onnx"
    selfie_path = tmp_path / "selfie.jpg"
    model_path.write_bytes(b"dummy-model")
    _write_selfie(selfie_path)
    monkeypatch.setattr(settings, "MINIFASNET_ENABLED", True)
    monkeypatch.setattr(settings, "MINIFASNET_MODEL_PATH", str(model_path))
    monkeypatch.setattr(settings, "MINIFASNET_MODEL_SHA256", "")
    monkeypatch.setattr(settings, "MINIFASNET_LIVE_CLASS_INDEX", 1)
    monkeypatch.setattr(settings, "ANTI_SPOOFING_MIN_SCORE", 0.7)
    _install_minifasnet_fakes(monkeypatch, [[0.1, 4.0, 0.2]])

    result = _minifasnet_verify_if_available(selfie_path)

    assert result.status == MINIFASNET_STATUS_PASSED
    assert result.label == "live"
    assert result.score is not None and result.score > 0.9


def test_minifasnet_spoof_score_fails(monkeypatch, tmp_path):
    model_path = tmp_path / "MiniFASNetV2.onnx"
    selfie_path = tmp_path / "selfie.jpg"
    model_path.write_bytes(b"dummy-model")
    _write_selfie(selfie_path)
    monkeypatch.setattr(settings, "MINIFASNET_ENABLED", True)
    monkeypatch.setattr(settings, "MINIFASNET_MODEL_PATH", str(model_path))
    monkeypatch.setattr(settings, "MINIFASNET_MODEL_SHA256", "")
    monkeypatch.setattr(settings, "MINIFASNET_LIVE_CLASS_INDEX", 1)
    monkeypatch.setattr(settings, "ANTI_SPOOFING_MIN_SCORE", 0.7)
    _install_minifasnet_fakes(monkeypatch, [[0.1, 0.2, 4.0]])

    result = _minifasnet_verify_if_available(selfie_path)

    assert result.status == MINIFASNET_STATUS_FAILED
    assert result.label == "spoof"
    assert result.score is not None and result.score < 0.1


def test_minifasnet_no_face_fails(monkeypatch, tmp_path):
    model_path = tmp_path / "MiniFASNetV2.onnx"
    selfie_path = tmp_path / "selfie.jpg"
    model_path.write_bytes(b"dummy-model")
    _write_selfie(selfie_path)
    monkeypatch.setattr(settings, "MINIFASNET_ENABLED", True)
    monkeypatch.setattr(settings, "MINIFASNET_MODEL_PATH", str(model_path))
    monkeypatch.setattr(settings, "MINIFASNET_MODEL_SHA256", "")
    _install_minifasnet_fakes(monkeypatch, [[0.1, 4.0, 0.2]], faces=[])

    result = _minifasnet_verify_if_available(selfie_path)

    assert result.status == MINIFASNET_STATUS_FAILED
    assert result.reason == "face_not_detected"
    assert result.score == 0.0


@pytest.mark.asyncio
async def test_minifasnet_missing_selfie_document_is_not_performed():
    class FakeScalarResult:
        def first(self):
            return None

    class FakeResult:
        def scalars(self):
            return FakeScalarResult()

    class FakeDb:
        async def execute(self, _query):
            return FakeResult()

    result = await compute_minifasnet_for_session(
        session_id=__import__("uuid").uuid4(),
        db=FakeDb(),
    )

    assert result.status == MINIFASNET_STATUS_NOT_PERFORMED
    assert result.reason == "missing_selfie"


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
