// ── BICEC VeriPass — Mock Data (Cameroon context) ──

import type { StepMeta, OCRField, ApplicationData } from '@/types';

// ── Step sequence ──────────────────────────────────────────────────────────────
export const STEP_SEQUENCE: StepMeta[] = [
  { id: 'welcome', label: 'Bienvenue', group: 'Démarrage', icon: 'home' },
  { id: 'language', label: 'Langue', group: 'Démarrage', icon: 'globe' },
  { id: 'phone-otp', label: 'Téléphone & OTP', group: 'Auth', icon: 'smartphone' },
  { id: 'email-verify', label: 'Email', group: 'Auth', icon: 'mail' },
  { id: 'pin-setup', label: 'Code PIN', group: 'Auth', icon: 'lock' },
  { id: 'biometrics', label: 'Biométrie', group: 'Auth', icon: 'fingerprint' },
  { id: 'id-front', label: 'CNI Recto', group: 'Identité', icon: 'credit-card' },
  { id: 'id-back', label: 'CNI Verso', group: 'Identité', icon: 'credit-card' },
  { id: 'ocr-review', label: 'Vérification OCR', group: 'Identité', icon: 'search' },
  { id: 'liveness', label: 'Détection Vivacité', group: 'Identité', icon: 'eye' },
  { id: 'address', label: 'Adresse', group: 'Domicile', icon: 'map-pin' },
  { id: 'address-proof', label: 'Justificatif', group: 'Domicile', icon: 'file-text' },
  { id: 'fiscal-id', label: 'NIU', group: 'Fiscal', icon: 'hash' },
  { id: 'consent', label: 'Consentement', group: 'Finalisation', icon: 'check-circle' },
  { id: 'signature', label: 'Signature', group: 'Finalisation', icon: 'pen-tool' },
  { id: 'review-summary', label: 'Récapitulatif', group: 'Finalisation', icon: 'clipboard' },
  { id: 'uploading', label: 'Envoi sécurisé', group: 'Finalisation', icon: 'upload' },
  { id: 'success', label: 'Soumis', group: 'Finalisation', icon: 'check' },
];

// ── Languages ──────────────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇨🇲', sub: 'Langue officielle' },
  { code: 'en', label: 'English', flag: '🇨🇲', sub: 'Official language' },
];

// ── NIU validation (identifiant fiscal DGI Cameroun) ──────────────────────────
// Le NIU est délivré par la DGI via Harmony (impots.cm).
// Il figure sur l'attestation d'immatriculation fiscale — document distinct de la CNI.
// Format : 1 lettre majuscule + 12 chiffres + 1 lettre majuscule = 14 caractères
// Exemple réel : P047217105784Y
//
// Le N° national CNI est différent :
//   Code poste (2 lettres + 2 chiffres) + identifiant unique 17 chiffres
//   (dont les 4 premiers = année de délivrance)
//   Exemple : YA0120260000123456789
export const NIU_REGEX = /^[A-Z]\d{12}[A-Z]$/;
export const NIU_EXAMPLE = 'P047217105784Y'; // exemple officiel DGI

export function validateNIU(value: string): boolean {
  return NIU_REGEX.test(value.trim().toUpperCase());
}

// ── Cameroonian administrative divisions ───────────────────────────────────────
// Région → Villes → Quartiers → Communes
export const REGIONS: Record<string, {
  villes: Record<string, {
    quartiers: string[];
    communes: string[];
  }>;
}> = {
  Centre: {
    villes: {
      Yaoundé: {
        quartiers: ['Bastos', 'Nlongkak', 'Mvan', 'Biyem-Assi', 'Nsimeyong', 'Mvog-Ada', 'Mvog-Mbi', 'Elig-Edzoa', 'Ekounou', 'Nkomo'],
        communes: ['Yaoundé I', 'Yaoundé II', 'Yaoundé III', 'Yaoundé IV', 'Yaoundé V', 'Yaoundé VI', 'Yaoundé VII'],
      },
      Mbalmayo: {
        quartiers: ['Centre ville', 'Nkol Mébanga', 'Enongal'],
        communes: ['Mbalmayo'],
      },
      Mfou: {
        quartiers: ['Mfou centre', 'Nkol Bogo'],
        communes: ['Mfou'],
      },
    },
  },
  Littoral: {
    villes: {
      Douala: {
        quartiers: ['Akwa', 'Bonanjo', 'Bali', 'Deido', 'Bonapriso', 'Ndokotti', 'Logbaba', 'Makepe', 'Kotto', 'Pk8'],
        communes: ['Douala I', 'Douala II', 'Douala III', 'Douala IV', 'Douala V', 'Douala VI'],
      },
      Edéa: {
        quartiers: ['Centre', 'Mbog Mbog'],
        communes: ['Edéa I', 'Edéa II'],
      },
    },
  },
  Ouest: {
    villes: {
      Bafoussam: {
        quartiers: ['Tamdja', 'Famla', 'Djeleng', 'Nylon'],
        communes: ['Bafoussam I', 'Bafoussam II', 'Bafoussam III'],
      },
      Dschang: {
        quartiers: ['Foreke', 'Tsinkop', 'Foto'],
        communes: ['Dschang'],
      },
    },
  },
  'Nord-Ouest': {
    villes: {
      Bamenda: {
        quartiers: ['Up Station', 'Mile 4', 'Nkwen', 'Mankon'],
        communes: ['Bamenda I', 'Bamenda II', 'Bamenda III'],
      },
    },
  },
  'Sud-Ouest': {
    villes: {
      Buea: {
        quartiers: ['Molyko', 'Bonduma', 'Great Soppo', 'Mile 16'],
        communes: ['Buea'],
      },
      Limbé: {
        quartiers: ['Down Beach', 'New Town', 'Church Street'],
        communes: ['Limbé I', 'Limbé II', 'Limbé III'],
      },
    },
  },
  Adamaoua: {
    villes: {
      Ngaoundéré: {
        quartiers: ['Dang', 'Baladji I', 'Baladji II', 'Joli Soir'],
        communes: ['Ngaoundéré I', 'Ngaoundéré II', 'Ngaoundéré III'],
      },
    },
  },
  Nord: {
    villes: {
      Garoua: {
        quartiers: ['Yelwa', 'Bibemi', 'Foulbéré'],
        communes: ['Garoua I', 'Garoua II', 'Garoua III'],
      },
    },
  },
  'Extrême-Nord': {
    villes: {
      Maroua: {
        quartiers: ['Domayo', 'Kakataré', 'Dougouré'],
        communes: ['Maroua I', 'Maroua II', 'Maroua III'],
      },
    },
  },
  Est: {
    villes: {
      Bertoua: {
        quartiers: ['Haoussa', 'Mokolo', 'Nkolbikon'],
        communes: ['Bertoua I', 'Bertoua II'],
      },
    },
  },
  Sud: {
    villes: {
      Ebolowa: {
        quartiers: ["Nko'olong", 'Angalé', 'Mvangan'],
        communes: ['Ebolowa I', 'Ebolowa II'],
      },
      Kribi: {
        quartiers: ['Grand Batanga', 'Afan Ngok', 'Dombé'],
        communes: ['Kribi I', 'Kribi II'],
      },
    },
  },
};

// Flat list of region names for the selector
export const REGION_NAMES = Object.keys(REGIONS);

// ── Mock OCR fields (CNI Cameroun — recto seulement) ──────────────────────────
// Note: le NIU ne figure PAS sur la CNI. Il vient de l'attestation DGI (Harmony).
// Le champ niuId ci-dessous est fourni séparément via le step fiscal-id.
export const MOCK_OCR_FIELDS: OCRField[] = [
  { key: 'nom', label: 'Nom de famille', value: 'MBARGA', confidence: 97, edited: false },
  { key: 'prenom', label: 'Prénom(s)', value: 'Adjoua Cécile', confidence: 94, edited: false },
  { key: 'numSerie', label: 'N° série CNI (recto)', value: '120000185', confidence: 92, edited: false },
  { key: 'dateNaissance', label: 'Date de naissance', value: '14/06/1992', confidence: 91, edited: false },
  { key: 'lieuNaissance', label: 'Lieu de naissance', value: 'Yaoundé', confidence: 88, edited: false },
  { key: 'dateExpiration', label: "Date d'expiration", value: '14/06/2033', confidence: 96, edited: false },
  { key: 'nationalite', label: 'Nationalité', value: 'Camerounaise', confidence: 99, edited: false },
];

// ── Mock applications (Back Office) ───────────────────────────────────────────
export const MOCK_APPLICATIONS: ApplicationData[] = [
  {
    id: 'VRF-2026-0001',
    fullName: 'Adjoua Cécile Mbarga',
    phone: '+237 6 74 12 34 56',
    email: 'mbarga.adjoua@gmail.com',
    nationalId: 'CNI-12000018542',
    niuId: 'P047217105784Y',
    dateOfBirth: '1992-06-14',
    address: 'Avenue Jean Paul II, Quartier Bastos',
    city: 'Yaoundé',
    region: 'Centre',
    quartier: 'Bastos',
    commune: 'Yaoundé I',
    status: 'pending',
    submittedAt: '2026-02-21T07:30:00Z',
    livenessScore: 96,
    idFrontUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Recto',
    idBackUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Verso',
    selfieUrl: 'https://placehold.co/200x200/2d6a4f/ffffff?text=Selfie',
    proofUrl: 'https://placehold.co/300x400/374151/ffffff?text=Facture+ENEO',
    signatureUrl: 'https://placehold.co/260x80/374151/ffffff?text=Signature',
    ocrFields: [
      { key: 'nom', label: 'Nom de famille', value: 'MBARGA', confidence: 97, edited: false },
      { key: 'prenom', label: 'Prénom(s)', value: 'Adjoua Cécile', confidence: 94, edited: false },
      { key: 'numSerie', label: 'N° série CNI', value: '120000185', confidence: 92, edited: false },
      { key: 'dateNaissance', label: 'Date naissance', value: '14/06/1992', confidence: 91, edited: false },
      { key: 'lieuNaissance', label: 'Lieu naissance', value: 'Yaoundé', confidence: 88, edited: false },
      { key: 'dateExpiration', label: 'Date expiration', value: '14/06/2033', confidence: 96, edited: false },
    ],
    validatorNotes: '',
  },
  {
    id: 'VRF-2026-0002',
    fullName: 'Kouassi Jean-Pierre Ndam',
    phone: '+237 6 90 43 21 08',
    email: 'jp.ndam@yahoo.fr',
    nationalId: 'CNI-09870654321',
    niuId: 'M123456789012N',
    dateOfBirth: '1985-11-03',
    address: 'Rue 1.757, Nouvelle Route Bastos',
    city: 'Yaoundé',
    region: 'Centre',
    quartier: 'Nlongkak',
    commune: 'Yaoundé II',
    status: 'pending',
    submittedAt: '2026-02-21T08:15:00Z',
    livenessScore: 91,
    idFrontUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Recto',
    idBackUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Verso',
    selfieUrl: 'https://placehold.co/200x200/2d6a4f/ffffff?text=Selfie',
    proofUrl: 'https://placehold.co/300x400/374151/ffffff?text=Facture+CAMWATER',
    signatureUrl: 'https://placehold.co/260x80/374151/ffffff?text=Signature',
    ocrFields: [
      { key: 'nom', label: 'Nom de famille', value: 'NDAM', confidence: 99, edited: false },
      { key: 'prenom', label: 'Prénom(s)', value: 'Kouassi Jean-Pierre', confidence: 95, edited: false },
      { key: 'numSerie', label: 'N° série CNI', value: '098706543', confidence: 93, edited: false },
      { key: 'dateNaissance', label: 'Date naissance', value: '03/11/1985', confidence: 93, edited: false },
      { key: 'lieuNaissance', label: 'Lieu naissance', value: 'Douala', confidence: 87, edited: false },
      { key: 'dateExpiration', label: 'Date expiration', value: '03/11/2035', confidence: 97, edited: false },
    ],
    validatorNotes: '',
  },
  {
    id: 'VRF-2026-0003',
    fullName: 'Epse Tchouamou Marie-Claire Fotso',
    phone: '+237 6 55 78 90 12',
    email: 'm.fotso75@gmail.com',
    nationalId: 'CNI-07623409812',
    niuId: '',  // NIU non fourni — accès limité
    dateOfBirth: '1975-03-22',
    address: 'Avenue Jean Paul II Bis, Face Hôtel Hilton',
    city: 'Yaoundé',
    region: 'Centre',
    quartier: 'Bastos',
    commune: 'Yaoundé I',
    status: 'limited',
    submittedAt: '2026-02-21T06:45:00Z',
    livenessScore: 88,
    idFrontUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Recto',
    idBackUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Verso',
    selfieUrl: 'https://placehold.co/200x200/2d6a4f/ffffff?text=Selfie',
    proofUrl: 'https://placehold.co/300x400/374151/ffffff?text=Facture+ENEO',
    signatureUrl: 'https://placehold.co/260x80/374151/ffffff?text=Signature',
    ocrFields: [
      { key: 'nom', label: 'Nom de famille', value: 'FOTSO EPSE TCHOUAMOU', confidence: 78, edited: false },
      { key: 'prenom', label: 'Prénom(s)', value: 'Marie-Claire', confidence: 82, edited: false },
      { key: 'numSerie', label: 'N° série CNI', value: '076234098', confidence: 70, edited: false },
      { key: 'dateNaissance', label: 'Date naissance', value: '22/03/1975', confidence: 91, edited: false },
      { key: 'lieuNaissance', label: 'Lieu naissance', value: 'Bafoussam', confidence: 72, edited: false },
      { key: 'dateExpiration', label: 'Date expiration', value: '22/03/2035', confidence: 89, edited: false },
    ],
    validatorNotes: 'NIU non fourni — attestation DGI manquante. Accès limité activé.',
  },
  {
    id: 'VRF-2026-0004',
    fullName: 'Ngono Essomba Patrick',
    phone: '+237 6 21 65 43 87',
    email: 'patrick.ngono@bicec.cm',
    nationalId: 'CNI-04512367809',
    niuId: 'K567890123456L',
    dateOfBirth: '1990-09-17',
    address: 'Rue Nachtigal, Quartier Nlongkak',
    city: 'Yaoundé',
    region: 'Centre',
    quartier: 'Nlongkak',
    commune: 'Yaoundé I',
    status: 'approved',
    submittedAt: '2026-02-20T15:22:00Z',
    livenessScore: 99,
    idFrontUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Recto',
    idBackUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Verso',
    selfieUrl: 'https://placehold.co/200x200/2d6a4f/ffffff?text=Selfie',
    proofUrl: 'https://placehold.co/300x400/374151/ffffff?text=Facture+ENEO',
    signatureUrl: 'https://placehold.co/260x80/374151/ffffff?text=Signature',
    ocrFields: [
      { key: 'nom', label: 'Nom de famille', value: 'NGONO ESSOMBA', confidence: 99, edited: false },
      { key: 'prenom', label: 'Prénom(s)', value: 'Patrick', confidence: 98, edited: false },
      { key: 'numSerie', label: 'N° série CNI', value: '045123678', confidence: 99, edited: false },
      { key: 'dateNaissance', label: 'Date naissance', value: '17/09/1990', confidence: 99, edited: false },
      { key: 'lieuNaissance', label: 'Lieu naissance', value: 'Ebolowa', confidence: 97, edited: false },
      { key: 'dateExpiration', label: 'Date expiration', value: '17/09/2034', confidence: 99, edited: false },
    ],
    validatorNotes: 'Tous documents conformes. NIU DGI validé. Approuvé.',
  },
  {
    id: 'VRF-2026-0005',
    fullName: 'Bella Njoya Inès',
    phone: '+237 6 88 09 54 32',
    email: 'ines.bella@outlook.com',
    nationalId: 'CNI-03301290045',
    niuId: 'T890123456789U',
    dateOfBirth: '1998-12-05',
    address: 'Boulevard de la Réunification, Akwa',
    city: 'Douala',
    region: 'Littoral',
    quartier: 'Akwa',
    commune: 'Douala I',
    status: 'rejected',
    submittedAt: '2026-02-20T09:10:00Z',
    livenessScore: 42,
    idFrontUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Recto',
    idBackUrl: 'https://placehold.co/300x190/1e3a5f/ffffff?text=CNI+Verso',
    selfieUrl: 'https://placehold.co/200x200/2d6a4f/ffffff?text=Selfie',
    proofUrl: 'https://placehold.co/300x400/374151/ffffff?text=Facture+CAMWATER',
    signatureUrl: 'https://placehold.co/260x80/374151/ffffff?text=Signature',
    rejectionReason: 'Score de vivacité insuffisant (42%). Correspondance visage non confirmée. Resoumettre avec une capture en lumière naturelle.',
    ocrFields: [
      { key: 'nom', label: 'Nom de famille', value: 'BELLA NJOYA', confidence: 55, edited: false },
      { key: 'prenom', label: 'Prénom(s)', value: 'Inès', confidence: 28, edited: false },
      { key: 'numSerie', label: 'N° série CNI', value: '033012900', confidence: 35, edited: false },
      { key: 'dateNaissance', label: 'Date naissance', value: '05/12/1998', confidence: 38, edited: false },
      { key: 'lieuNaissance', label: 'Lieu naissance', value: 'Kumba', confidence: 47, edited: false },
      { key: 'dateExpiration', label: 'Date expiration', value: '05/12/2033', confidence: 52, edited: false },
    ],
    validatorNotes: 'Vivacité échouée × 2. Score facial: 42%. Dossier rejeté.',
  },
];
