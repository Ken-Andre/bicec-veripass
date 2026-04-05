/**
 * Utilitaires d'export CSV et COBAC
 * Source: veripass-gatekeeper prototype (src/lib/export-utils.ts)
 * Mapping vers BICEC VeriPass
 *
 * WARNING: L'export COBAC JSON doit être validé par la conformité backend
 * avant envoi au régulateur.
 */

import type { KycSession, AuditEntry } from '@/types';

/**
 * Télécharge un fichier CSV généré depuis des données
 *
 * @param data - Données à exporter (tableau d'objets)
 * @param filename - Nom du fichier
 */
export function downloadCsv(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const v = String(row[h] ?? '');
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"`
          : v;
      })
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  triggerDownload(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Génère et télécharge l'export COBAC (format JSON)
 * Conforme aux exigences de reporting COBAC R-2023/01
 *
 * @param session - Session KYC à exporter
 * @param auditEntries - Entrées d'audit associées
 */
export function generateCobacExport(
  session: KycSession,
  auditEntries: AuditEntry[]
): void {
  const dossier = {
    exportDate: new Date().toISOString(),
    exportType: 'COBAC_COMPLIANCE',
    version: '1.0',
    client: {
      niu: session.clientIdentity.niu,
      nom: session.clientIdentity.lastName,
      prenom: session.clientIdentity.firstName,
      dateNaissance: session.clientIdentity.dateOfBirth,
      lieuNaissance: session.clientIdentity.placeOfBirth,
      sexe: session.clientIdentity.gender,
      nationalite: session.clientIdentity.nationality,
      adresse: session.clientIdentity.address,
      telephone: session.clientIdentity.phone,
    },
    dossier: {
      id: session.id,
      statut: session.status,
      niveauAcces: session.accessLevel,
      priorite: session.priority,
      agence: session.agencyCode,
      confidenceGlobale: session.overallConfidence,
      drapeaux: session.flags,
      dateCreation: session.createdAt,
      dateMiseAJour: session.updatedAt,
      echeanceSLA: session.slaDeadline,
    },
    documents: session.documents.map((d) => ({
      id: d.id,
      type: d.type,
      dateUpload: d.uploadedAt,
      champsOCR: d.ocrFields.map((f) => ({
        champ: f.fieldName,
        valeurExtraite: f.extractedValue,
        valeurCorrigee: f.correctedValue,
        confidence: f.confidence,
        necessiteRevision: f.needsReview,
      })),
    })),
    biometrie: session.biometrics
      ? {
          correspondanceVisage: session.biometrics.faceMatchScore,
          vivacite: session.biometrics.livenessScore,
          antiUsurpation: session.biometrics.antiSpoofingScore,
          qualiteSelfie: session.biometrics.selfieQuality,
        }
      : null,
    pisteAudit: auditEntries.map((e) => ({
      horodatage: e.timestamp,
      agent: e.agentName,
      action: e.actionType,
      etatPrecedent: e.previousState,
      nouvelEtat: e.newState,
      justification: e.rationale,
    })),
  };

  const json = JSON.stringify(dossier, null, 2);
  triggerDownload(
    json,
    `COBAC_${session.clientIdentity.niu}_${session.id}.json`,
    'application/json'
  );
}

/**
 * Déclenche le téléchargement d'un blob côté client
 */
function triggerDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}