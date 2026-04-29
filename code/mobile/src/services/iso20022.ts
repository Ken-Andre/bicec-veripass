/**
 * ISO 20022 message builders for VeriPass banking flow.
 *
 * Client-side preview generation. Real submission happens server-side.
 * Supports pacs.008 (FI to FI Customer Credit Transfer).
 */

import type { CreditTransferInput, BuiltCreditTransfer, IsoScheme } from '../types';

const IBAN_REGEX = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;
const BIC_REGEX = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export function isValidIban(iban: string): boolean {
  if (!iban) return false;
  const s = iban.replace(/\s+/g, '').toUpperCase();
  return IBAN_REGEX.test(s);
}

export function isValidBic(bic: string): boolean {
  if (!bic) return true;
  return BIC_REGEX.test(bic.toUpperCase());
}

function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

function esc(v: string): string {
  return v.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!)
  );
}

export function buildPacs008(input: CreditTransferInput): BuiltCreditTransfer {
  const msgId = genId('MSG');
  const endToEndId = genId('E2E');
  const instrId = genId('INSTR');
  const createdAt = new Date().toISOString();
  const amt = input.amount.toFixed(2);
  const ccy = (input.currency || 'XAF').toUpperCase();
  const scheme: IsoScheme = input.scheme ?? 'XAF-RTGS';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>${esc(msgId)}</MsgId>
      <CreDtTm>${createdAt}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>${esc(instrId)}</InstrId>
        <EndToEndId>${esc(endToEndId)}</EndToEndId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="${esc(ccy)}">${amt}</IntrBkSttlmAmt>
      <ChrgBr>SLEV</ChrgBr>
      <Dbtr><Nm>${esc(input.debtorName)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${esc(input.debtorIban)}</IBAN></Id></DbtrAcct>
      ${input.debtorBic ? `<DbtrAgt><FinInstnId><BICFI>${esc(input.debtorBic)}</BICFI></FinInstnId></DbtrAgt>` : ''}
      <Cdtr><Nm>${esc(input.creditorName)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${esc(input.creditorIban)}</IBAN></Id></CdtrAcct>
      ${input.creditorBic ? `<CdtrAgt><FinInstnId><BICFI>${esc(input.creditorBic)}</BICFI></FinInstnId></CdtrAgt>` : ''}
      ${input.remittance ? `<RmtInf><Ustrd>${esc(input.remittance.slice(0, 140))}</Ustrd></RmtInf>` : ''}
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;

  return { msgId, endToEndId, instrId, createdAt, xml, scheme };
}

export function downloadIsoXml(filename: string, xml: string): void {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
