"""Run the live KYC happy-path acceptance flow and write proof artifacts.

This is intentionally a host-run script. It exercises the rebuilt Docker stack
through the public HTTPS endpoint, uses real CNI notebook images, and records
every API status/body needed by the delivery tracker.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import shutil
import ssl
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, parse, request


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EVIDENCE_DIR = ROOT / "docs" / "test-evidence" / "latest" / "kyc-happy-path"
DEFAULT_CNI_RECTO = ROOT / "paddleocr_test" / "notebooks" / "output" / "images" / "cni_0_recto.jpg"
DEFAULT_CNI_VERSO = ROOT / "paddleocr_test" / "notebooks" / "output" / "images" / "cni_0_verso.jpg"


class ApiFailure(RuntimeError):
    def __init__(self, message: str, *, step: str, status: int | None, body: str):
        super().__init__(message)
        self.step = step
        self.status = status
        self.body = body


class LiveApi:
    def __init__(self, base_url: str, evidence_dir: Path):
        self.base_url = base_url.rstrip("/")
        self.api_url = f"{self.base_url}/api/v1"
        self.evidence_dir = evidence_dir
        self.context = ssl._create_unverified_context()
        self.steps: list[dict] = []

    def request_json(
        self,
        step: str,
        method: str,
        path: str,
        *,
        token: str | None = None,
        device_tag: str | None = None,
        payload: dict | None = None,
        expected: set[int] | None = None,
    ) -> dict:
        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if device_tag:
            headers["X-Device-Tag"] = device_tag
        return self._send(step, method, path, headers=headers, data=data, expected=expected or {200})

    def request_multipart(
        self,
        step: str,
        path: str,
        *,
        token: str,
        device_tag: str | None = None,
        fields: dict[str, str],
        files: dict[str, Path],
        expected: set[int] | None = None,
    ) -> dict:
        boundary = f"----veripass-{uuid.uuid4().hex}"
        body = bytearray()
        for name, value in fields.items():
            body.extend(f"--{boundary}\r\n".encode())
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
            body.extend(str(value).encode("utf-8"))
            body.extend(b"\r\n")
        for name, path_obj in files.items():
            mime = mimetypes.guess_type(str(path_obj))[0] or "application/octet-stream"
            body.extend(f"--{boundary}\r\n".encode())
            body.extend(
                (
                    f'Content-Disposition: form-data; name="{name}"; '
                    f'filename="{path_obj.name}"\r\n'
                    f"Content-Type: {mime}\r\n\r\n"
                ).encode()
            )
            body.extend(path_obj.read_bytes())
            body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode())
        headers = {
            "Accept": "application/json",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {token}",
        }
        if device_tag:
            headers["X-Device-Tag"] = device_tag
        return self._send(
            step,
            "POST",
            path,
            headers=headers,
            data=bytes(body),
            expected=expected or {200, 201},
        )

    def _send(
        self,
        step: str,
        method: str,
        path: str,
        *,
        headers: dict[str, str],
        data: bytes | None,
        expected: set[int],
    ) -> dict:
        url = path if path.startswith("http") else f"{self.api_url}{path}"
        started = time.perf_counter()
        response_status: int | None = None
        text = ""
        try:
            req = request.Request(url=url, data=data, headers=headers, method=method)
            with request.urlopen(req, context=self.context, timeout=180) as resp:
                response_status = resp.status
                text = resp.read().decode("utf-8", errors="replace")
        except error.HTTPError as exc:
            response_status = exc.code
            text = exc.read().decode("utf-8", errors="replace")
        except error.URLError as exc:
            raise ApiFailure(str(exc), step=step, status=None, body=str(exc)) from exc

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        body = _parse_json(text)
        self.steps.append(
            {
                "step": step,
                "method": method,
                "url": _redact_url(url),
                "status": response_status,
                "elapsed_ms": elapsed_ms,
                "ok": response_status in expected,
                "body": _sanitize_body(body),
            }
        )
        if response_status not in expected:
            raise ApiFailure(
                f"{step} returned {response_status}, expected {sorted(expected)}",
                step=step,
                status=response_status,
                body=text,
            )
        return body if isinstance(body, dict) else {"data": body}


def _parse_json(text: str):
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text[:1000]}


def _redact_url(url: str) -> str:
    parsed = parse.urlsplit(url)
    query = parse.parse_qsl(parsed.query, keep_blank_values=True)
    redacted = [(k, "***" if "token" in k.lower() or "key" in k.lower() else v) for k, v in query]
    return parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parse.urlencode(redacted), parsed.fragment))


def _sanitize_body(value):
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            lowered = key.lower()
            if "token" in lowered or lowered in {"otp", "otp_debug"}:
                result[key] = "***"
            elif isinstance(item, (dict, list)):
                result[key] = _sanitize_body(item)
            else:
                result[key] = item
        return result
    if isinstance(value, list):
        return [_sanitize_body(item) for item in value]
    return value


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _copy_input_images(evidence_dir: Path, recto: Path, verso: Path) -> dict[str, str]:
    images_dir = evidence_dir / "input-images"
    images_dir.mkdir(parents=True, exist_ok=True)
    copied = {}
    for label, src in {"cni_recto": recto, "cni_verso": verso}.items():
        target = images_dir / f"{label}{src.suffix.lower()}"
        shutil.copy2(src, target)
        copied[label] = str(target.relative_to(ROOT)).replace("\\", "/")
    return copied


def _write_sample_pdf(path: Path, *, title: str, reference: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "BT",
        "/F1 18 Tf",
        "72 760 Td",
        f"({title}) Tj",
        "0 -32 Td",
        "/F1 11 Tf",
        f"(Reference: {reference}) Tj",
        "0 -20 Td",
        "(Client: Marie Acceptance) Tj",
        "0 -20 Td",
        "(Adresse: Bastos, Yaounde I, Centre, Cameroun) Tj",
        "0 -20 Td",
        "(Montant: 24 500 XAF) Tj",
        "0 -20 Td",
        "(Date facture: 15/05/2026) Tj",
        "ET",
    ]
    stream = "\n".join(lines).encode("ascii")
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
        b"5 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" + stream + b"\nendstream endobj\n",
    ]
    raw = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(raw))
        raw.extend(obj)
    xref_start = len(raw)
    raw.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    raw.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        raw.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    raw.extend(
        (
            f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_start}\n%%EOF\n"
        ).encode("ascii")
    )
    path.write_bytes(bytes(raw))
    return path


def _landmarks() -> list[dict]:
    frames = []
    for idx in range(40):
        frames.append(
            {
                "frame": idx,
                "landmarks": [
                    {"x": 0.48 + idx * 0.0005, "y": 0.50, "z": 0.0},
                    {"x": 0.50 + idx * 0.002, "y": 0.50 + idx * 0.001, "z": 0.0},
                    {"x": 0.52 + idx * 0.0005, "y": 0.50, "z": 0.0},
                ],
            }
        )
    return frames


def run(args: argparse.Namespace) -> int:
    evidence_dir = args.evidence_dir.resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)

    cni_recto = args.cni_recto.resolve()
    cni_verso = args.cni_verso.resolve()
    if not cni_recto.exists() or not cni_verso.exists():
        raise FileNotFoundError(f"Missing CNI images: {cni_recto} / {cni_verso}")

    api = LiveApi(args.base_url, evidence_dir)
    now = datetime.now(timezone.utc)
    run_id = now.strftime("%Y%m%d%H%M%S")
    phone = args.phone or f"+237699{run_id[-6:]}"
    fingerprint = f"acceptance-{run_id}-{uuid.uuid4().hex[:8]}"

    copied_images = _copy_input_images(evidence_dir, cni_recto, cni_verso)
    generated_dir = evidence_dir / "generated-documents"
    bill_pdf = _write_sample_pdf(
        generated_dir / "bill_eneo_acceptance.pdf",
        title="FACTURE ENEO - ACCEPTANCE",
        reference=f"ENEO-{run_id}",
    )
    support_pdf = _write_sample_pdf(
        generated_dir / "support_address_proof_acceptance.pdf",
        title="JUSTIFICATIF COMPLEMENTAIRE - ACCEPTANCE",
        reference=f"SUPPORT-{run_id}",
    )
    health = api.request_json("health", "GET", f"{args.base_url.rstrip('/')}/api/health", expected={200})

    otp_send = api.request_json(
        "mobile otp send",
        "POST",
        "/auth/otp/send",
        payload={"phone": phone, "mode": "signup"},
        expected={200},
    )
    otp = otp_send.get("otp_debug")
    if not otp:
        raise ApiFailure(
            "OTP debug is unavailable; this script must run against non-production env.",
            step="mobile otp send",
            status=200,
            body=json.dumps(otp_send),
        )
    tokens = api.request_json(
        "mobile otp verify",
        "POST",
        "/auth/otp/verify",
        payload={"phone": phone, "otp": otp},
        expected={200},
    )
    mobile_token = tokens["access_token"]

    device = api.request_json(
        "device register",
        "POST",
        "/devices/register",
        token=mobile_token,
        payload={
            "fingerprint_hash": fingerprint,
            "metadata": {
                "platform": "acceptance-script",
                "timezone": "Europe/Paris",
                "evidence_run_id": run_id,
            },
        },
        expected={200},
    )
    device_tag = device["device_tag"]

    session = api.request_json(
        "kyc session start",
        "POST",
        "/kyc/session/start",
        token=mobile_token,
        device_tag=device_tag,
        expected={200},
    )
    session_handle = session["session_id"]

    recto = api.request_multipart(
        "upload cni recto notebook image",
        "/kyc/capture/cni",
        token=mobile_token,
        device_tag=device_tag,
        fields={"side": "RECTO", "session_id": session_handle, "client_sha256": _sha256(cni_recto)},
        files={"file": cni_recto},
    )
    verso = api.request_multipart(
        "upload cni verso notebook image",
        "/kyc/capture/cni",
        token=mobile_token,
        device_tag=device_tag,
        fields={"side": "VERSO", "session_id": session_handle, "client_sha256": _sha256(cni_verso)},
        files={"file": cni_verso},
    )
    bill = api.request_multipart(
        "upload bill acceptance pdf",
        "/kyc/capture/bill",
        token=mobile_token,
        device_tag=device_tag,
        fields={"bill_type": "ENEO", "session_id": session_handle, "client_sha256": _sha256(bill_pdf)},
        files={"file": bill_pdf},
    )
    selfie = api.request_multipart(
        "upload selfie evidence",
        "/kyc/document/upload",
        token=mobile_token,
        device_tag=device_tag,
        fields={"doc_type": "SELFIE", "client_sha256": _sha256(cni_recto)},
        files={"file": cni_recto},
    )

    api.request_json(
        "ocr correction review",
        "POST",
        "/kyc/ocr/review",
        token=mobile_token,
        device_tag=device_tag,
        payload={
            "fields": {
                "full_name": "Marie Acceptance",
                "document_number": f"CNI-{run_id}",
                "birth_date": "01/01/1995",
                "expiry_date": "31/12/2030",
            }
        },
    )
    liveness = api.request_json(
        "liveness submit",
        "POST",
        "/kyc/liveness/submit",
        token=mobile_token,
        device_tag=device_tag,
        payload={"challenge_type": "turn_right", "landmarks_json": _landmarks()},
    )
    # Attente du résultat du face match asynchrone (géré par Celery)
    max_retries = 30
    delay = 1.0
    for attempt in range(max_retries):
        session_current = api.request_json(
            "kyc session current get",
            "GET",
            "/kyc/session/current",
            token=mobile_token,
            device_tag=device_tag,
        )
        bio = session_current.get("biometric_result")
        if bio:
            status = bio.get("face_match_status")
            if status not in {"PENDING", "PROCESSING"}:
                liveness["face_match_status"] = status
                liveness["face_match_score"] = bio.get("face_match_score")
                liveness["face_match_reason"] = bio.get("face_match_reason")
                liveness["anti_spoofing_score"] = bio.get("anti_spoofing_score")
                break
        time.sleep(delay)

    if liveness.get("face_match_status") not in {"PASSED", "FAILED"}:
        raise ApiFailure(
            "Liveness completed without an attempted face match",
            step="liveness submit",
            status=200,
            body=json.dumps(liveness),
        )
    api.request_json(
        "address submit",
        "POST",
        "/kyc/address/submit",
        token=mobile_token,
        device_tag=device_tag,
        payload={
            "region": "Centre",
            "city": "Yaounde",
            "commune": "Yaounde I",
            "quartier": "Bastos",
            "lieu_dit": "BICEC acceptance",
            "gps_lat": 3.8792,
            "gps_lng": 11.5037,
        },
    )
    api.request_json(
        "consent submit",
        "POST",
        "/kyc/consent/submit",
        token=mobile_token,
        device_tag=device_tag,
        payload={
            "cgu_accepted": True,
            "privacy_accepted": True,
            "data_processing_accepted": True,
            "consent_method": "ACCEPTANCE_SCRIPT",
        },
    )
    api.request_json(
        "niu submit",
        "POST",
        "/kyc/niu/submit",
        token=mobile_token,
        device_tag=device_tag,
        payload={"niu_type": "DECLARATIVE", "niu_value": f"M{run_id[:11]}0Z"},
    )
    one_px_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    api.request_json(
        "signature submit",
        "POST",
        "/kyc/signature/submit",
        token=mobile_token,
        device_tag=device_tag,
        payload={"signature_data": f"data:image/png;base64,{one_px_png}"},
    )
    readiness = api.request_json(
        "readiness before submit",
        "GET",
        "/kyc/readiness",
        token=mobile_token,
        device_tag=device_tag,
    )
    if readiness.get("can_submit") is not True:
        raise ApiFailure(
            "KYC readiness did not allow submission",
            step="readiness before submit",
            status=200,
            body=json.dumps(readiness),
        )
    submitted = api.request_json(
        "kyc submit",
        "POST",
        "/kyc/submit",
        token=mobile_token,
        device_tag=device_tag,
        expected={200},
    )

    jean_token = _agent_login(api)
    queue = api.request_json(
        "jean queue lookup",
        "GET",
        f"/backoffice/queue?status=PENDING_AGENT_REVIEW&limit=100&client_name={parse.quote(phone)}",
        token=jean_token,
    )
    dossier = _find_dossier(queue, phone)
    session_id = dossier["id"]
    api.request_json("jean dossier open", "GET", f"/backoffice/dossier/{session_id}", token=jean_token)
    auto_assign = api.request_json(
        "jean auto assign",
        "POST",
        f"/backoffice/dossier/{session_id}/auto-assign",
        token=jean_token,
        expected={200},
    )
    info_request = api.request_json(
        "jean request complementary file",
        "POST",
        f"/backoffice/dossier/{session_id}/review",
        token=jean_token,
        payload={
            "decision": "INFO_REQUESTED",
            "reason": "Merci de transmettre un justificatif complementaire lisible.",
        },
    )
    review_status_info = api.request_json(
        "client sees info requested",
        "GET",
        "/kyc/review-status",
        token=mobile_token,
        device_tag=device_tag,
    )

    limits = api.request_json("support attachment limits", "GET", "/support/attachment-limits", token=mobile_token)
    thread = api.request_json("support current thread", "GET", "/support/threads/current", token=mobile_token)
    message = api.request_json(
        "support text message",
        "POST",
        f"/support/threads/{thread['id']}/messages",
        token=mobile_token,
        payload={"content": "Bonjour, je transmets le justificatif complementaire demande."},
        expected={201},
    )
    attachment = api.request_multipart(
        "support attachment upload address proof pdf",
        f"/support/threads/{thread['id']}/attachments",
        token=mobile_token,
        fields={"content": "Justificatif complementaire joint.", "sha256": _sha256(support_pdf)},
        files={"file": support_pdf},
        expected={201},
    )
    document_id = attachment.get("attachment_document_id")
    if not document_id:
        raise ApiFailure(
            "Support attachment did not create a dossier document id",
            step="support attachment upload notebook image",
            status=201,
            body=json.dumps(attachment),
        )
    classify = api.request_json(
        "jean classify complementary file",
        "POST",
        f"/backoffice/dossier/{session_id}/documents/{document_id}/classify",
        token=jean_token,
        payload={
            "categories": ["ADDRESS_PROOF"],
            "primary_doc_type": "ADDRESS_PROOF",
            "reason": "Client sent requested complementary address proof via support chat.",
        },
    )
    approval = api.request_json(
        "jean approve dossier",
        "POST",
        f"/backoffice/dossier/{session_id}/review",
        token=jean_token,
        payload={
            "decision": "APPROVED",
            "reason": "Dossier complet apres justificatif complementaire.",
            "biometric_override_confirmed": True,
        },
    )
    final_status = api.request_json(
        "client sees approved status",
        "GET",
        "/kyc/review-status",
        token=mobile_token,
        device_tag=device_tag,
    )
    if final_status.get("status") != "APPROVED":
        raise ApiFailure(
            "Client final review status is not APPROVED",
            step="client sees approved status",
            status=200,
            body=json.dumps(final_status),
        )

    summary = {
        "generated_at": now.isoformat(),
        "base_url": args.base_url,
        "client_phone": phone,
        "session_handle": session_handle,
        "raw_session_id": session_id,
        "input_images": copied_images,
        "generated_documents": {
            "bill_pdf": str(bill_pdf.relative_to(ROOT)).replace("\\", "/"),
            "support_address_proof_pdf": str(support_pdf.relative_to(ROOT)).replace("\\", "/"),
        },
        "source_image_hashes": {
            "cni_recto_sha256": _sha256(cni_recto),
            "cni_verso_sha256": _sha256(cni_verso),
            "bill_pdf_sha256": _sha256(bill_pdf),
            "support_address_proof_pdf_sha256": _sha256(support_pdf),
        },
        "key_results": {
            "health": health,
            "recto_doc": {"id": recto.get("id"), "ocr_status": recto.get("ocr_status")},
            "verso_doc": {"id": verso.get("id"), "ocr_status": verso.get("ocr_status")},
            "bill_doc": {"id": bill.get("id"), "ocr_status": bill.get("ocr_status")},
            "selfie_doc": {"id": selfie.get("id"), "sha256_hash": selfie.get("sha256_hash")},
            "liveness": liveness,
            "readiness": readiness,
            "submitted": submitted,
            "auto_assign": auto_assign,
            "info_request": info_request,
            "review_status_info": review_status_info,
            "support_limits": limits,
            "support_message": message,
            "support_attachment": attachment,
            "classify": classify,
            "approval": approval,
            "final_status": final_status,
        },
        "steps": api.steps,
    }
    proof_json = evidence_dir / "kyc-happy-path-live-api-proof.json"
    proof_json.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    proof_md = evidence_dir / "README.md"
    proof_md.write_text(_markdown(summary, proof_json), encoding="utf-8")
    print(f"KYC happy path acceptance PASS: {proof_md}")
    return 0


def _agent_login(api: LiveApi) -> str:
    last_error: ApiFailure | None = None
    for password in ("password123", "Password123!"):
        try:
            body = api.request_json(
                "jean agent login",
                "POST",
                "/auth/agent/login",
                payload={"email": "jean@bicec.cm", "password": password},
                expected={200},
            )
            return body["access_token"]
        except ApiFailure as exc:
            last_error = exc
    assert last_error is not None
    raise last_error


def _find_dossier(queue: dict, phone: str) -> dict:
    items = queue.get("items") or []
    for item in items:
        if item.get("client_phone") == phone or item.get("client_name") == phone:
            return item
    raise ApiFailure(
        f"Submitted dossier for {phone} was not found in JEAN queue.",
        step="jean queue lookup",
        status=200,
        body=json.dumps(queue),
    )


def _markdown(summary: dict, proof_json: Path) -> str:
    lines = [
        "# KYC Happy Path Live API Proof",
        "",
        f"- Generated at: `{summary['generated_at']}`",
        f"- Base URL: `{summary['base_url']}`",
        f"- Client phone: `{summary['client_phone']}`",
        f"- Raw backoffice session id: `{summary['raw_session_id']}`",
        f"- Full JSON proof: `{proof_json.relative_to(ROOT).as_posix()}`",
        "",
        "## Input Images",
        "",
    ]
    for label, rel in summary["input_images"].items():
        lines.append(f"- {label}: `{rel}`")
    lines.extend(["", "## Generated Acceptance Documents", ""])
    for label, rel in summary["generated_documents"].items():
        lines.append(f"- {label}: `{rel}`")
    lines.extend(
        [
            "",
            "## Key Results",
            "",
            f"- CNI recto OCR status: `{summary['key_results']['recto_doc']['ocr_status']}`",
            f"- CNI verso OCR status: `{summary['key_results']['verso_doc']['ocr_status']}`",
            f"- Bill PDF OCR status: `{summary['key_results']['bill_doc']['ocr_status']}`",
            f"- Liveness alive: `{summary['key_results']['liveness'].get('is_alive')}`",
            f"- Readiness can_submit: `{summary['key_results']['readiness'].get('can_submit')}`",
            f"- Submitted status: `{summary['key_results']['submitted'].get('status')}`",
            f"- Info-request status: `{summary['key_results']['info_request'].get('new_status')}`",
            f"- Support image limit: `{summary['key_results']['support_limits'].get('image_max_size_mb')} Mo`",
            f"- Support PDF limit: `{summary['key_results']['support_limits'].get('pdf_max_size_mb')} Mo / {summary['key_results']['support_limits'].get('pdf_max_pages')} pages`",
            f"- Classified doc type: `{summary['key_results']['classify'].get('doc_type')}`",
            f"- Approval status: `{summary['key_results']['approval'].get('new_status')}`",
            f"- Client final status: `{summary['key_results']['final_status'].get('status')}`",
            "",
            "## API Step Statuses",
            "",
            "| Step | Method | Status | Elapsed |",
            "| --- | --- | --- | ---: |",
        ]
    )
    for step in summary["steps"]:
        lines.append(
            f"| {step['step']} | `{step['method']}` | `{step['status']}` | {step['elapsed_ms']} ms |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="https://localhost")
    parser.add_argument("--evidence-dir", type=Path, default=DEFAULT_EVIDENCE_DIR)
    parser.add_argument("--cni-recto", type=Path, default=DEFAULT_CNI_RECTO)
    parser.add_argument("--cni-verso", type=Path, default=DEFAULT_CNI_VERSO)
    parser.add_argument("--phone")
    args = parser.parse_args()
    try:
        return run(args)
    except ApiFailure as exc:
        print(f"ACCEPTANCE FAILED at {exc.step}: {exc}", file=sys.stderr)
        print(f"status={exc.status} body={exc.body[:2000]}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
