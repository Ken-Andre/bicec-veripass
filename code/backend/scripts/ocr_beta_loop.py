from __future__ import annotations

import argparse
import hashlib
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


FIELD_ORDER = [
    "nom",
    "prenom",
    "date_naissance",
    "lieu_naissance",
    "sexe",
    "taille",
    "profession",
    "numero_cni",
    "date_delivrance",
    "date_expiration",
    "pere",
    "mere",
    "sp",
    "adresse",
    "autorite_nom",
    "poste_identification",
]

TRANSIENT_STATUS_CODES = {500, 502, 503, 504}


def _phone_for_pair(pair_id: int) -> str:
    return f"+23768{pair_id:02d}{random.randint(0, 99999):05d}"


def _headers(token: str, device_tag: str | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    if device_tag:
        headers["X-Device-Tag"] = device_tag
    return headers


def _best_fields(session: dict[str, Any]) -> dict[str, dict[str, Any]]:
    best: dict[str, dict[str, Any]] = {}
    for doc in session.get("documents", []):
        if doc.get("doc_type") not in {"CNI_RECTO", "CNI_VERSO"}:
            continue
        for field in doc.get("ocr_fields", []):
            name = field.get("field_name")
            if not name:
                continue
            conf = float(field.get("confidence_score") or 0.0)
            value = field.get("corrected_value") or field.get("extracted_value")
            current = best.get(name)
            current_conf = float(current.get("confidence") or 0.0) if current else -1.0
            current_value = current.get("value") if current else None
            if current is None or conf > current_conf or (conf == current_conf and value and not current_value):
                best[name] = {
                    "value": value,
                    "confidence": conf,
                    "doc_type": doc.get("doc_type"),
                    "ocr_status": doc.get("ocr_status"),
                }
    return {name: best.get(name, {"value": None, "confidence": 0.0}) for name in FIELD_ORDER}


def _classify_fields(fields: dict[str, dict[str, Any]]) -> dict[str, str]:
    classifications: dict[str, str] = {}
    for name, field in fields.items():
        value = field.get("value")
        confidence = float(field.get("confidence") or 0.0)
        if value in (None, ""):
            classifications[name] = "missing_field"
        elif confidence < 0.70:
            classifications[name] = "low_confidence_value"
        else:
            classifications[name] = "present"
    return classifications


def _post_json(session: requests.Session, url: str, **kwargs: Any) -> dict[str, Any]:
    for attempt in range(3):
        response = session.post(url, timeout=60, **kwargs)
        if response.status_code not in TRANSIENT_STATUS_CODES:
            response.raise_for_status()
            return response.json()
        if attempt == 2:
            response.raise_for_status()
        time.sleep(2 + attempt * 3)
    raise RuntimeError("unreachable retry state")


def create_account(session: requests.Session, base_url: str, pair_id: int) -> dict[str, Any]:
    phone = _phone_for_pair(pair_id)
    otp_response = _post_json(session, f"{base_url}/auth/otp/send", json={"phone": phone})
    otp = otp_response["otp_debug"]
    token_response = _post_json(
        session,
        f"{base_url}/auth/otp/verify",
        json={"phone": phone, "otp": otp},
    )
    token = token_response["access_token"]
    user = session.get(f"{base_url}/auth/me", headers=_headers(token), timeout=30)
    user.raise_for_status()

    fingerprint = hashlib.sha256(f"ocr-beta:{pair_id}:{phone}".encode("utf-8")).hexdigest()
    device_response = _post_json(
        session,
        f"{base_url}/devices/register",
        json={"fingerprint_hash": fingerprint, "metadata": {"source": "ocr_beta_loop", "pair_id": pair_id}},
        headers={**_headers(token), "X-Device-Fingerprint": fingerprint},
    )

    return {
        "pair_id": pair_id,
        "phone": phone,
        "token": token,
        "user": user.json(),
        "device_tag": device_response["device_tag"],
        "session_handle": token_response["session_handle"],
    }


def upload_cni_pair(
    session: requests.Session,
    base_url: str,
    account: dict[str, Any],
    image_dir: Path,
) -> dict[str, Any]:
    token = account["token"]
    device_tag = account["device_tag"]
    session_handle = account["session_handle"]
    headers = _headers(token, device_tag)
    uploads: dict[str, Any] = {}
    for side in ("RECTO", "VERSO"):
        path = image_dir / f"cni_{account['pair_id']}_{side.lower()}.jpg"
        for attempt in range(3):
            with path.open("rb") as file:
                response = session.post(
                    f"{base_url}/kyc/capture/cni",
                    headers=headers,
                    data={"side": side, "session_id": session_handle},
                    files={"file": (path.name, file, "image/jpeg")},
                    timeout=180,
                )
            if response.status_code not in TRANSIENT_STATUS_CODES:
                response.raise_for_status()
                break
            if attempt == 2:
                response.raise_for_status()
            time.sleep(2 + attempt * 3)
        uploads[side.lower()] = response.json()
    return uploads


def fetch_session(session: requests.Session, base_url: str, account: dict[str, Any]) -> dict[str, Any]:
    response = session.get(
        f"{base_url}/kyc/session/current",
        headers=_headers(account["token"], account["device_tag"]),
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def run_pair(base_url: str, image_dir: Path, pair_id: int) -> dict[str, Any]:
    session = requests.Session()
    account = create_account(session, base_url, pair_id)
    uploads = upload_cni_pair(session, base_url, account, image_dir)
    session_data = fetch_session(session, base_url, account)
    fields = _best_fields(session_data)
    return {
        "pair_id": pair_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "account": {
            "phone": account["phone"],
            "user": account["user"],
            "session_handle": account["session_handle"],
            "device_tag": account["device_tag"],
        },
        "images": {
            "recto": str(image_dir / f"cni_{pair_id}_recto.jpg"),
            "verso": str(image_dir / f"cni_{pair_id}_verso.jpg"),
        },
        "uploads": uploads,
        "documents": session_data.get("documents", []),
        "ocr_review_fields": fields,
        "initial_classification": _classify_fields(fields),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8001/api/v1")
    parser.add_argument("--image-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--pairs",
        help="Comma-separated CNI ids and ranges, for example: 0,1,3,7,16-17",
    )
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=59)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    if args.pairs:
        pair_ids = []
        for part in args.pairs.split(","):
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                start, end = (int(value.strip()) for value in part.split("-", 1))
                pair_ids.extend(range(start, end + 1))
            else:
                pair_ids.append(int(part))
    else:
        pair_ids = list(range(args.start, args.end + 1))
    if args.limit is not None:
        pair_ids = pair_ids[: args.limit]

    summary: list[dict[str, Any]] = []
    for pair_id in pair_ids:
        started = time.perf_counter()
        try:
            result = run_pair(args.base_url, args.image_dir, pair_id)
            (args.output / f"cni_{pair_id:02d}.json").write_text(
                json.dumps(result, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            status = "ok"
            error = None
        except Exception as exc:
            result = {"pair_id": pair_id, "error": repr(exc), "timestamp": datetime.now(timezone.utc).isoformat()}
            (args.output / f"cni_{pair_id:02d}.error.json").write_text(
                json.dumps(result, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            status = "error"
            error = repr(exc)
        elapsed = round(time.perf_counter() - started, 2)
        row = {"pair_id": pair_id, "status": status, "elapsed_seconds": elapsed, "error": error}
        summary.append(row)
        print(json.dumps(row), flush=True)

    (args.output / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
