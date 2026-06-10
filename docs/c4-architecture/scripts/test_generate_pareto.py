from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path

import pytest


class _FakeAxis:
    transAxes = object()

    def scatter(self, *_args, **_kwargs) -> None:
        return None

    def annotate(self, *_args, **_kwargs) -> None:
        return None

    def set_yscale(self, *_args, **_kwargs) -> None:
        return None

    def set_ylim(self, *_args, **_kwargs) -> None:
        return None

    def set_xlim(self, *_args, **_kwargs) -> None:
        return None

    def grid(self, *_args, **_kwargs) -> None:
        return None

    def set_xlabel(self, *_args, **_kwargs) -> None:
        return None

    def set_ylabel(self, *_args, **_kwargs) -> None:
        return None

    def set_title(self, *_args, **_kwargs) -> None:
        return None

    def set_yticks(self, *_args, **_kwargs) -> None:
        return None

    def set_yticklabels(self, *_args, **_kwargs) -> None:
        return None

    def set_xticks(self, *_args, **_kwargs) -> None:
        return None

    def axvspan(self, *_args, **_kwargs) -> None:
        return None

    def legend(self, *_args, **_kwargs) -> None:
        return None

    def text(self, *_args, **_kwargs) -> None:
        return None

    def axis(self, *_args, **_kwargs) -> None:
        return None


class _FakeFigure:
    class _Patch:
        def set_facecolor(self, *_args, **_kwargs) -> None:
            return None

    patch = _Patch()


class _FakePyplot(types.ModuleType):
    def __init__(self) -> None:
        super().__init__("matplotlib.pyplot")

    def subplots(self, *_args, **_kwargs) -> tuple[_FakeFigure, _FakeAxis]:
        return _FakeFigure(), _FakeAxis()

    def Line2D(self, *_args, **_kwargs) -> object:
        return object()

    def tight_layout(self) -> None:
        return None

    def savefig(self, path: Path, *_args, **_kwargs) -> None:
        suffix = Path(path).suffix.lower()
        content = b"<svg>ADR-040 Pareto</svg>" if suffix == ".svg" else b"\x89PNG\r\nPareto"
        Path(path).write_bytes(content * 80)

    def close(self, *_args, **_kwargs) -> None:
        return None

    def imread(self, *_args, **_kwargs) -> None:
        return None


def _install_fake_matplotlib(monkeypatch: pytest.MonkeyPatch) -> None:
    matplotlib = types.ModuleType("matplotlib")
    matplotlib.use = lambda *_args, **_kwargs: None
    patches = types.ModuleType("matplotlib.patches")
    patches.FancyBboxPatch = object

    monkeypatch.setitem(sys.modules, "matplotlib", matplotlib)
    monkeypatch.setitem(sys.modules, "matplotlib.pyplot", _FakePyplot())
    monkeypatch.setitem(sys.modules, "matplotlib.patches", patches)


def _load_module(monkeypatch: pytest.MonkeyPatch):
    _install_fake_matplotlib(monkeypatch)
    script_path = Path(__file__).with_name("generate_pareto.py")
    spec = importlib.util.spec_from_file_location("generate_pareto", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_pareto_data_entries_are_renderable(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_module(monkeypatch)

    codes = [entry["code"] for entry in module.DATA]

    assert codes == ["A", "B", "C", "D", "E", "F", "G"]
    assert len(codes) == len(set(codes))
    assert all(1 <= entry["x"] <= 5 for entry in module.DATA)
    assert all(entry["sov"] in module.SOV_COLOR for entry in module.DATA)
    assert all(entry["sov"] in module.SOV_LABEL for entry in module.DATA)
    assert all(entry["scale"] in module.SCALE_SIZE for entry in module.DATA)


def test_main_writes_svg_and_png_to_configured_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load_module(monkeypatch)
    output = tmp_path / "pareto-test.svg"

    monkeypatch.setattr(module, "DIAGRAMS_DIR", tmp_path)
    monkeypatch.setattr(module, "OUTPUT", output)

    module.main()

    png_output = output.with_suffix(".png")
    assert output.exists()
    assert png_output.exists()
    assert output.stat().st_size > 0
    assert png_output.stat().st_size > 0
    svg_text = output.read_text(encoding="utf-8")
    assert "ADR-040" in svg_text
    assert "Pareto" in svg_text
