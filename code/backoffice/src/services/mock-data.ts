import { KycStatus, AccessLevel, Priority, DocumentType, DossierFlag, type KycSession, type OcrField, type KycDocument } from '@/types/kyc';
import { ActionType, type AuditEntry } from '@/types/audit';
import { AmlSeverity, AmlAlertStatus, type AmlAlert, type NiuConflict, type Agency, type BatchJob } from '@/types/aml';
import { AgentRole, type User, type Notification } from '@/types/auth';

// ===== USERS =====
// Note: These mock users use AgentRole enum aligned with backend
// JEAN = Agent KYC Validateur, THOMAS = Superviseur AML, SYLVIE = Directrice Ops, ADMIN_IT = Admin Système
export const mockUsers: User[] = [
  { id: 'u-admin', email: 'admin@bicec.cm', name: 'Admin IT', role: AgentRole.ADMIN_IT, agencyId: 'DLA-001', isActive: true },
  { id: 'u-jean', email: 'jean@bicec.cm', name: 'Jean Dupont', role: AgentRole.JEAN, agencyId: 'DLA-001', isActive: true },
  { id: 'u-thomas', email: 'thomas@bicec.cm', name: 'Thomas Martin', role: AgentRole.THOMAS, agencyId: 'DLA-001', isActive: true },
  { id: 'u-sylvie', email: 'sylvie@bicec.cm', name: 'Sylvie Bernard', role: AgentRole.SYLVIE, agencyId: 'DLA-001', isActive: true },
];

// ===== AGENCIES =====
export const mockAgencies: Agency[] = [
  { id: 'ag-1', code: 'DLA-001', name: 'Agence Douala Bonanjo', city: 'Douala', isActive: true, agentCount: 12 },
  { id: 'ag-2', code: 'YDE-001', name: 'Agence Yaoundé Centre', city: 'Yaoundé', isActive: true, agentCount: 8 },
  { id: 'ag-3', code: 'DLA-002', name: 'Agence Douala Akwa', city: 'Douala', isActive: true, agentCount: 6 },
  { id: 'ag-4', code: 'BAF-001', name: 'Agence Bafoussam', city: 'Bafoussam', isActive: false, agentCount: 3 },
];

// ===== HELPER =====
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}
function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600000).toISOString();
}

function makeOcrFields(confidence: number): OcrField[] {
  const base = [
    { id: 'f1', fieldName: 'Nom', extractedValue: 'NKOULOU', confidence: Math.min(confidence + 0.05, 1), bbox: { x: 120, y: 80, width: 200, height: 30 }, documentType: DocumentType.CNI_RECTO, needsReview: false },
    { id: 'f2', fieldName: 'Prénom', extractedValue: 'Paul André', confidence: confidence, bbox: { x: 120, y: 120, width: 220, height: 30 }, documentType: DocumentType.CNI_RECTO, needsReview: confidence < 0.7 },
    { id: 'f3', fieldName: 'Date de naissance', extractedValue: '15/03/1985', confidence: Math.min(confidence + 0.1, 1), bbox: { x: 120, y: 160, width: 150, height: 30 }, documentType: DocumentType.CNI_RECTO, needsReview: false },
    { id: 'f4', fieldName: 'Lieu de naissance', extractedValue: 'Douala', confidence: confidence - 0.1, bbox: { x: 120, y: 200, width: 180, height: 30 }, documentType: DocumentType.CNI_RECTO, needsReview: (confidence - 0.1) < 0.7 },
    { id: 'f5', fieldName: 'NIU', extractedValue: 'P058400' + Math.floor(Math.random() * 10000).toString().padStart(4, '0'), confidence: confidence - 0.15, bbox: { x: 120, y: 240, width: 200, height: 30 }, documentType: DocumentType.CNI_VERSO, needsReview: (confidence - 0.15) < 0.7 },
    { id: 'f6', fieldName: 'Numéro CNI', extractedValue: Math.floor(100000000 + Math.random() * 900000000).toString(), confidence: confidence + 0.02, bbox: { x: 300, y: 80, width: 180, height: 30 }, documentType: DocumentType.CNI_RECTO, needsReview: false },
  ];
  return base;
}

function makeDocuments(): KycDocument[] {
  return [
    { id: 'd1', type: DocumentType.CNI_RECTO, url: '/placeholder.svg', uploadedAt: hoursAgo(3), ocrFields: [] },
    { id: 'd2', type: DocumentType.CNI_VERSO, url: '/placeholder.svg', uploadedAt: hoursAgo(3), ocrFields: [] },
    { id: 'd3', type: DocumentType.SELFIE, url: '/placeholder.svg', uploadedAt: hoursAgo(3), ocrFields: [] },
    { id: 'd4', type: DocumentType.PROOF_OF_ADDRESS, url: '/placeholder.svg', uploadedAt: hoursAgo(3), ocrFields: [] },
  ];
}

const names = [
  { first: 'Paul André', last: 'NKOULOU', city: 'Douala' },
  { first: 'Marie Claire', last: 'ATANGANA', city: 'Yaoundé' },
  { first: 'Joseph', last: 'TCHATCHOUA', city: 'Bafoussam' },
  { first: 'Françoise', last: 'EYENGA', city: 'Douala' },
  { first: 'Emmanuel', last: 'MVONDO', city: 'Yaoundé' },
  { first: 'Hélène', last: 'BIKOULA', city: 'Douala' },
  { first: 'Pierre', last: 'NJOYA', city: 'Bafoussam' },
  { first: 'Cécile', last: 'MBOUDA', city: 'Douala' },
  { first: 'Roger', last: 'ELONG', city: 'Kribi' },
  { first: 'Brigitte', last: 'TONYE', city: 'Douala' },
  { first: 'Samuel', last: 'KAMGA', city: 'Yaoundé' },
  { first: 'Anne', last: 'FOKOU', city: 'Douala' },
  { first: 'David', last: 'TSAFACK', city: 'Bafoussam' },
  { first: 'Esther', last: 'MBAH', city: 'Douala' },
  { first: 'Lucien', last: 'NGANOU', city: 'Yaoundé' },
  { first: 'Patricia', last: 'DJOMOU', city: 'Douala' },
];

// ===== MOCK SESSIONS =====
export const mockSessions: KycSession[] = names.map((n, i) => {
  const conf = [0.92, 0.87, 0.74, 0.61, 0.95, 0.55, 0.82, 0.68, 0.91, 0.43, 0.78, 0.89, 0.66, 0.73, 0.84, 0.58][i];
  const statuses = [
    KycStatus.PENDING_REVIEW, KycStatus.PENDING_REVIEW, KycStatus.MANUAL_REVIEW,
    KycStatus.AML_FLAGGED, KycStatus.PENDING_REVIEW, KycStatus.OCR_FAILED,
    KycStatus.PENDING_REVIEW, KycStatus.MANUAL_REVIEW, KycStatus.PENDING_REVIEW,
    KycStatus.AML_CHECK, KycStatus.PENDING_REVIEW, KycStatus.READY_FOR_OPS,
    KycStatus.MANUAL_REVIEW, KycStatus.PENDING_REVIEW, KycStatus.PENDING_REVIEW,
    KycStatus.BIOMETRIC_FAILED,
  ];
  const flags: DossierFlag[][] = [
    [], [], [DossierFlag.LOW_OCR], [DossierFlag.AML_HIT], [],
    [DossierFlag.LOW_OCR], [], [DossierFlag.NIU_DECLARATIF], [], [DossierFlag.DUPLICATE],
    [], [], [DossierFlag.LOW_OCR, DossierFlag.NIU_DECLARATIF], [DossierFlag.EXPIRED_DOC], [], [DossierFlag.LOW_OCR],
  ];
  const priorities = [Priority.HIGH, Priority.MEDIUM, Priority.HIGH, Priority.HIGH, Priority.LOW,
    Priority.MEDIUM, Priority.LOW, Priority.HIGH, Priority.MEDIUM, Priority.HIGH,
    Priority.LOW, Priority.LOW, Priority.HIGH, Priority.MEDIUM, Priority.LOW, Priority.MEDIUM];

  const ocrFields = makeOcrFields(conf);
  const docs = makeDocuments();
  docs[0].ocrFields = ocrFields.filter(f => f.documentType === DocumentType.CNI_RECTO);
  docs[1].ocrFields = ocrFields.filter(f => f.documentType === DocumentType.CNI_VERSO);

  return {
    id: `sess-${(i + 1).toString().padStart(3, '0')}`,
    clientIdentity: {
      id: `cli-${i + 1}`,
      niu: ocrFields.find(f => f.fieldName === 'NIU')?.extractedValue || `P0584${i}`,
      firstName: n.first,
      lastName: n.last,
      dateOfBirth: `${1975 + (i % 20)}-${((i % 12) + 1).toString().padStart(2, '0')}-${((i % 28) + 1).toString().padStart(2, '0')}`,
      placeOfBirth: n.city,
      gender: i % 3 === 0 ? 'F' : 'M',
      nationality: 'Camerounaise',
      address: `${100 + i} Rue ${n.city}, ${n.city}`,
      phone: `+237 6${Math.floor(10000000 + Math.random() * 90000000)}`,
    },
    status: statuses[i],
    accessLevel: AccessLevel.RESTRICTED,
    priority: priorities[i],
    flags: flags[i],
    documents: docs,
    biometrics: {
      faceMatchScore: 0.6 + Math.random() * 0.35,
      livenessScore: 0.7 + Math.random() * 0.28,
      antiSpoofingScore: 0.65 + Math.random() * 0.3,
      selfieQuality: 0.5 + Math.random() * 0.45,
    },
    assignedAgentId: statuses[i] === KycStatus.MANUAL_REVIEW ? 'u-jean' : undefined,
    agencyCode: ['DLA-001', 'YDE-001', 'DLA-002'][i % 3],
    overallConfidence: conf,
    createdAt: hoursAgo(1 + i * 0.3),
    updatedAt: hoursAgo(0.5 + i * 0.2),
    slaDeadline: hoursFromNow(2 - i * 0.1),
  };
});

// ===== AML ALERTS =====
export const mockAmlAlerts: AmlAlert[] = [
  {
    id: 'aml-1', sessionId: 'sess-004', clientName: 'Françoise EYENGA', niu: 'P05843201',
    severity: AmlSeverity.HIGH, status: AmlAlertStatus.PENDING,
    hits: [
      { id: 'h1', listName: 'UN Sanctions List', matchedName: 'F. EYENGA', matchScore: 0.87, listType: 'SANCTIONS', details: 'Matched against UN consolidated list entry #4521', country: 'CM' },
    ],
    createdAt: hoursAgo(1),
  },
  {
    id: 'aml-2', sessionId: 'sess-010', clientName: 'Samuel KAMGA', niu: 'P05840082',
    severity: AmlSeverity.CRITICAL, status: AmlAlertStatus.PENDING,
    hits: [
      { id: 'h2', listName: 'CEMAC PEP List', matchedName: 'S. KAMGA', matchScore: 0.92, listType: 'PEP', details: 'Politically exposed person — former minister', country: 'CM' },
      { id: 'h3', listName: 'Adverse Media DB', matchedName: 'Samuel Kamga', matchScore: 0.78, listType: 'ADVERSE_MEDIA', details: 'Referenced in financial fraud investigation 2024', country: 'CM' },
    ],
    createdAt: hoursAgo(2),
  },
  {
    id: 'aml-3', sessionId: 'sess-007', clientName: 'Pierre NJOYA', niu: 'P05849102',
    severity: AmlSeverity.MEDIUM, status: AmlAlertStatus.UNDER_REVIEW, reviewedBy: 'u-thomas',
    hits: [
      { id: 'h4', listName: 'COBAC Watch List', matchedName: 'P. NJOYA', matchScore: 0.65, listType: 'PEP', details: 'Minor match — common name pattern', country: 'CM' },
    ],
    createdAt: hoursAgo(5),
  },
];

// ===== NIU CONFLICTS =====
export const mockNiuConflicts: NiuConflict[] = [
  {
    id: 'nc-1', niu: 'P05843201',
    sessionA: { id: 'sess-004', clientName: 'Françoise EYENGA', createdAt: hoursAgo(5), confidence: 0.61 },
    sessionB: { id: 'sess-017', clientName: 'Françoise EYANGA', createdAt: hoursAgo(2), confidence: 0.58 },
    similarityScore: 0.89, status: 'PENDING',
  },
  {
    id: 'nc-2', niu: 'P05849102',
    sessionA: { id: 'sess-007', clientName: 'Pierre NJOYA', createdAt: hoursAgo(10), confidence: 0.82 },
    sessionB: { id: 'sess-018', clientName: 'Pierre NJOYA FOTSO', createdAt: hoursAgo(1), confidence: 0.76 },
    similarityScore: 0.94, status: 'PENDING',
  },
];

// ===== AUDIT LOG =====
export const mockAuditLog: AuditEntry[] = [
  { id: 'aud-1', timestamp: hoursAgo(4), agentId: 'system', agentName: 'Système', actionType: ActionType.SYSTEM_AUTO, previousState: KycStatus.DOCUMENT_UPLOADED, newState: KycStatus.OCR_PROCESSING, rationale: 'OCR processing auto-triggered', sessionId: 'sess-001' },
  { id: 'aud-2', timestamp: hoursAgo(3.5), agentId: 'system', agentName: 'Système', actionType: ActionType.SYSTEM_AUTO, previousState: KycStatus.OCR_PROCESSING, newState: KycStatus.OCR_COMPLETED, rationale: 'OCR completed with confidence 0.92', sessionId: 'sess-001' },
  { id: 'aud-3', timestamp: hoursAgo(3), agentId: 'system', agentName: 'Système', actionType: ActionType.BIOMETRIC_CHECK, previousState: KycStatus.BIOMETRIC_PENDING, newState: KycStatus.BIOMETRIC_COMPLETED, rationale: 'Biometric verification passed — face match 0.94', sessionId: 'sess-001' },
  { id: 'aud-4', timestamp: hoursAgo(2), agentId: 'system', agentName: 'Système', actionType: ActionType.SYSTEM_AUTO, previousState: KycStatus.AML_CHECK, newState: KycStatus.AML_CLEARED, rationale: 'No sanctions matches found', sessionId: 'sess-001' },
  { id: 'aud-5', timestamp: hoursAgo(1.5), agentId: 'u-jean', agentName: 'Jean Mbarga', actionType: ActionType.ASSIGN, previousState: KycStatus.PENDING_REVIEW, newState: KycStatus.MANUAL_REVIEW, rationale: 'Dossier pris en charge pour validation', sessionId: 'sess-003' },
  { id: 'aud-6', timestamp: hoursAgo(1), agentId: 'u-jean', agentName: 'Jean Mbarga', actionType: ActionType.FIELD_EDIT, previousState: KycStatus.MANUAL_REVIEW, newState: KycStatus.MANUAL_REVIEW, rationale: 'Correction du champ "Lieu de naissance": Bafousam → Bafoussam', sessionId: 'sess-003' },
  { id: 'aud-7', timestamp: hoursAgo(0.5), agentId: 'u-thomas', agentName: 'Thomas Ndongo', actionType: ActionType.AML_CLEAR, previousState: 'AML_FLAGGED', newState: 'AML_CLEARED', rationale: 'Faux positif confirmé — homonymie avec entrée liste sanctions', sessionId: 'sess-007' },
];

// ===== NOTIFICATIONS =====
export const mockNotifications: Notification[] = [
  { id: 'n1', title: 'Nouveau dossier prioritaire', message: 'Dossier sess-004 flaggé AML — traitement urgent requis', type: 'warning', read: false, createdAt: hoursAgo(0.5), link: '/validation/dossier/sess-004' },
  { id: 'n2', title: 'SLA critique', message: '3 dossiers approchent la limite de 2h', type: 'error', read: false, createdAt: hoursAgo(1) },
  { id: 'n3', title: 'OCR échoué', message: 'Dossier sess-006 — extraction OCR échouée, intervention manuelle requise', type: 'error', read: true, createdAt: hoursAgo(2) },
  { id: 'n4', title: 'Batch Amplitude terminé', message: 'Batch #2847 terminé — 94/100 dossiers traités', type: 'success', read: true, createdAt: hoursAgo(3) },
  { id: 'n5', title: 'Conflit NIU détecté', message: 'Doublon potentiel sur NIU P05843201', type: 'warning', read: false, createdAt: hoursAgo(0.2) },
];

// ===== BATCH JOBS =====
export const mockBatchJobs: BatchJob[] = [
  { id: 'batch-1', type: 'Amplitude Sync', status: 'COMPLETED', totalItems: 100, processedItems: 94, failedItems: 6, startedAt: hoursAgo(4), completedAt: hoursAgo(3) },
  { id: 'batch-2', type: 'OCR Reprocessing', status: 'RUNNING', totalItems: 50, processedItems: 32, failedItems: 2, startedAt: hoursAgo(1) },
  { id: 'batch-3', type: 'AML Screening', status: 'FAILED', totalItems: 200, processedItems: 145, failedItems: 55, startedAt: hoursAgo(6), completedAt: hoursAgo(5) },
];
