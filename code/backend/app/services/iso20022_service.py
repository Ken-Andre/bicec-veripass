"""ISO 20022 message generation service (server-side)."""

import uuid
from datetime import datetime, timezone
from xml.sax.saxutils import escape as xml_escape


def _gen_id(prefix: str) -> str:
    rand = uuid.uuid4().hex[:8].upper()
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{rand}"


def build_pacs_008(
    *,
    debtor_name: str,
    debtor_iban: str,
    debtor_bic: str | None = None,
    creditor_name: str,
    creditor_iban: str,
    creditor_bic: str | None = None,
    amount: float,
    currency: str = "XAF",
    remittance: str | None = None,
    scheme: str = "XAF-RTGS",
) -> dict:
    """Build a pacs.008.001.10 XML message for FI-to-FI Customer Credit Transfer."""
    msg_id = _gen_id("MSG")
    end_to_end_id = _gen_id("E2E")
    instr_id = _gen_id("INSTR")
    created_at = datetime.now(timezone.utc).isoformat()
    amt = f"{amount:.2f}"
    ccy = currency.upper()

    esc = xml_escape

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10">',
        "  <FIToFICstmrCdtTrf>",
        "    <GrpHdr>",
        f"      <MsgId>{esc(msg_id)}</MsgId>",
        f"      <CreDtTm>{created_at}</CreDtTm>",
        "      <NbOfTxs>1</NbOfTxs>",
        "      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>",
        "    </GrpHdr>",
        "    <CdtTrfTxInf>",
        "      <PmtId>",
        f"        <InstrId>{esc(instr_id)}</InstrId>",
        f"        <EndToEndId>{esc(end_to_end_id)}</EndToEndId>",
        "      </PmtId>",
        f'      <IntrBkSttlmAmt Ccy="{esc(ccy)}">{amt}</IntrBkSttlmAmt>',
        "      <ChrgBr>SLEV</ChrgBr>",
        f"      <Dbtr><Nm>{esc(debtor_name)}</Nm></Dbtr>",
        f"      <DbtrAcct><Id><IBAN>{esc(debtor_iban)}</IBAN></Id></DbtrAcct>",
    ]

    if debtor_bic:
        parts.append(f"      <DbtrAgt><FinInstnId><BICFI>{esc(debtor_bic)}</BICFI></FinInstnId></DbtrAgt>")

    parts.extend([
        f"      <Cdtr><Nm>{esc(creditor_name)}</Nm></Cdtr>",
        f"      <CdtrAcct><Id><IBAN>{esc(creditor_iban)}</IBAN></Id></CdtrAcct>",
    ])

    if creditor_bic:
        parts.append(f"      <CdtrAgt><FinInstnId><BICFI>{esc(creditor_bic)}</BICFI></FinInstnId></CdtrAgt>")

    if remittance:
        parts.append(f"      <RmtInf><Ustrd>{esc(remittance[:140])}</Ustrd></RmtInf>")

    parts.extend([
        "    </CdtTrfTxInf>",
        "  </FIToFICstmrCdtTrf>",
        "</Document>",
    ])

    xml = "\n".join(parts)

    return {
        "msg_id": msg_id,
        "end_to_end_id": end_to_end_id,
        "instr_id": instr_id,
        "scheme": scheme,
        "xml": xml,
        "created_at": created_at,
    }
