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
// Format réel : 1 lettre majuscule + 12 chiffres + 1 lettre majuscule = 14 caractères
// Exemple réel : P047217105784Y
//
// Le N° national CNI est différent :
//   Code poste (2 lettres + 2 chiffres) + identifiant unique 17 chiffres
//   (dont les 4 premiers = année de délivrance)
//   Exemple : YA01 2026 0012345678901
export const NIU_REGEX = /^[A-Z]\d{12}[A-Z]$/;
export const NIU_EXAMPLE = 'P047217105784Y'; // exemple officiel DGI

export function validateNIU(value: string): boolean {
  return NIU_REGEX.test(value.trim().toUpperCase());
}

// ── Cameroonian administrative divisions ───────────────────────────────────────
// Région → Villes → Quartiers (chaque quartier mappé à sa commune)
// Un quartier n'appartient qu'à une seule commune — la commune est auto-sélectionnée.
export type QuartierEntry = { name: string; commune: string };

export const REGIONS: Record<string, {
  villes: Record<string, {
    quartiers: QuartierEntry[];
  }>;
}> = {
  Centre: {
    villes: {
      Yaoundé: {
        quartiers: [
          { name: 'Bastos', commune: 'Yaoundé I' },
          { name: 'Elig-Edzoa', commune: 'Yaoundé II' },
          { name: 'Nlongkak', commune: 'Yaoundé II' },
          { name: 'Mvog-Mbi', commune: 'Yaoundé III' },
          { name: 'Mvan', commune: 'Yaoundé III' },
          { name: 'Mvog-Ada', commune: 'Yaoundé V' },
          { name: 'Ekounou', commune: 'Yaoundé V' },
          { name: 'Biyem-Assi', commune: 'Yaoundé VI' },
          { name: 'Nsimeyong', commune: 'Yaoundé VI' },
          { name: 'Nkomo', commune: 'Yaoundé VII' },
        ],
      },
      Mbalmayo: {
        quartiers: [
          { name: 'Centre ville', commune: 'Mbalmayo' },
          { name: 'Nkol Mébanga', commune: 'Mbalmayo' },
          { name: 'Enongal', commune: 'Mbalmayo' },
        ],
      },
      Mfou: {
        quartiers: [
          { name: 'Mfou centre', commune: 'Mfou' },
          { name: 'Nkol Bogo', commune: 'Mfou' },
        ],
      },
    },
  },
  Littoral: {
    villes: {
      Douala: {
        quartiers: [
          { name: 'Akwa', commune: 'Douala I' },
          { name: 'Bonanjo', commune: 'Douala I' },
          { name: 'Bonapriso', commune: 'Douala I' },
          { name: 'Deido', commune: 'Douala II' },
          { name: 'Ndokotti', commune: 'Douala II' },
          { name: 'Kotto', commune: 'Douala III' },
          { name: 'Bali', commune: 'Douala V' },
          { name: 'Logbaba', commune: 'Douala V' },
          { name: 'Makepe', commune: 'Douala V' },
          { name: 'Pk8', commune: 'Douala VI' },
        ],
      },
      Edéa: {
        quartiers: [
          { name: 'Centre', commune: 'Edéa I' },
          { name: 'Mbog Mbog', commune: 'Edéa II' },
        ],
      },
    },
  },
  Ouest: {
    villes: {
      Bafoussam: {
        quartiers: [
          { name: 'Tamdja', commune: 'Bafoussam I' },
          { name: 'Famla', commune: 'Bafoussam II' },
          { name: 'Djeleng', commune: 'Bafoussam II' },
          { name: 'Nylon', commune: 'Bafoussam III' },
        ],
      },
      Dschang: {
        quartiers: [
          { name: 'Foreke', commune: 'Dschang' },
          { name: 'Tsinkop', commune: 'Dschang' },
          { name: 'Foto', commune: 'Dschang' },
        ],
      },
    },
  },
  'Nord-Ouest': {
    villes: {
      Bamenda: {
        quartiers: [
          { name: 'Up Station', commune: 'Bamenda I' },
          { name: 'Mile 4', commune: 'Bamenda II' },
          { name: 'Nkwen', commune: 'Bamenda II' },
          { name: 'Mankon', commune: 'Bamenda III' },
        ],
      },
    },
  },
  'Sud-Ouest': {
    villes: {
      Buea: {
        quartiers: [
          { name: 'Molyko', commune: 'Buea' },
          { name: 'Bonduma', commune: 'Buea' },
          { name: 'Great Soppo', commune: 'Buea' },
          { name: 'Mile 16', commune: 'Buea' },
        ],
      },
      Limbé: {
        quartiers: [
          { name: 'Down Beach', commune: 'Limbé I' },
          { name: 'New Town', commune: 'Limbé II' },
          { name: 'Church Street', commune: 'Limbé III' },
        ],
      },
    },
  },
  Adamaoua: {
    villes: {
      Ngaoundéré: {
        quartiers: [
          { name: 'Dang', commune: 'Ngaoundéré I' },
          { name: 'Baladji I', commune: 'Ngaoundéré II' },
          { name: 'Baladji II', commune: 'Ngaoundéré II' },
          { name: 'Joli Soir', commune: 'Ngaoundéré III' },
        ],
      },
    },
  },
  Nord: {
    villes: {
      Garoua: {
        quartiers: [
          { name: 'Yelwa', commune: 'Garoua I' },
          { name: 'Bibemi', commune: 'Garoua II' },
          { name: 'Foulbéré', commune: 'Garoua III' },
        ],
      },
    },
  },
  'Extrême-Nord': {
    villes: {
      Maroua: {
        quartiers: [
          { name: 'Domayo', commune: 'Maroua I' },
          { name: 'Kakataré', commune: 'Maroua II' },
          { name: 'Dougouré', commune: 'Maroua III' },
        ],
      },
    },
  },
  Est: {
    villes: {
      Bertoua: {
        quartiers: [
          { name: 'Haoussa', commune: 'Bertoua I' },
          { name: 'Mokolo', commune: 'Bertoua II' },
          { name: 'Nkolbikon', commune: 'Bertoua II' },
        ],
      },
    },
  },
  Sud: {
    villes: {
      Ebolowa: {
        quartiers: [
          { name: "Nko'olong", commune: 'Ebolowa I' },
          { name: 'Angalé', commune: 'Ebolowa I' },
          { name: 'Mvangan', commune: 'Ebolowa II' },
        ],
      },
      Kribi: {
        quartiers: [
          { name: 'Grand Batanga', commune: 'Kribi I' },
          { name: 'Afan Ngok', commune: 'Kribi I' },
          { name: 'Dombé', commune: 'Kribi II' },
        ],
      },
    },
  },
};

// Flat list of region names for the selector
export const REGION_NAMES = Object.keys(REGIONS);

// ── Mock OCR fields (CNI Cameroun — recto) ────────────────────────────────────
// N° national CNI = code poste (2 lettres + 2 chiffres) + 17 chiffres (4 premiers = année)
// Exemple : YA01 — 20090012345678901
// Le NIU ne figure PAS sur la CNI. Il vient de l'attestation DGI (Harmony).
export const MOCK_OCR_FIELDS: OCRField[] = [
  { key: 'nom', label: 'Nom de famille', value: 'MBARGA', confidence: 97, edited: false },
  { key: 'prenom', label: 'Prénom(s)', value: 'Adjoua Cécile', confidence: 94, edited: false },
  { key: 'numNational', label: 'N° national CNI', value: 'YA01 2009 0012345678901', confidence: 91, edited: false },
  { key: 'dateNais', label: 'Date de naissance', value: '14/06/1992', confidence: 91, edited: false },
  { key: 'lieuNais', label: 'Lieu de naissance', value: 'Yaoundé', confidence: 88, edited: false },
  { key: 'dateExp', label: "Date d'expiration CNI", value: '14/06/2033', confidence: 96, edited: false },
  { key: 'nationalite', label: 'Nationalité', value: 'Camerounaise', confidence: 99, edited: false },
];

// ── Mock applications (Back Office) ───────────────────────────────────────────
export const MOCK_APPLICATIONS: ApplicationData[] = [
  {
    id: 'VRF-2026-0001',
    fullName: 'Adjoua Cécile Mbarga',
    phone: '+237 6 74 12 34 56',
    email: 'mbarga.adjoua@gmail.com',
    nationalId: 'YA01 2009 0012345678901',
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
      { key: 'numNational', label: 'N° national CNI', value: 'YA01 2009 0012345678901', confidence: 91, edited: false },
      { key: 'dateNais', label: 'Date naissance', value: '14/06/1992', confidence: 91, edited: false },
      { key: 'lieuNais', label: 'Lieu naissance', value: 'Yaoundé', confidence: 88, edited: false },
      { key: 'dateExp', label: 'Expiration CNI', value: '14/06/2033', confidence: 96, edited: false },
    ],
    validatorNotes: '',
  },
  {
    id: 'VRF-2026-0002',
    fullName: 'Kouassi Jean-Pierre Ndam',
    phone: '+237 6 90 43 21 08',
    email: 'jp.ndam@yahoo.fr',
    nationalId: 'DL03 1985 9870654321012',
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
      { key: 'numNational', label: 'N° national CNI', value: 'DL03 1985 9870654321012', confidence: 90, edited: false },
      { key: 'dateNais', label: 'Date naissance', value: '03/11/1985', confidence: 93, edited: false },
      { key: 'lieuNais', label: 'Lieu naissance', value: 'Douala', confidence: 87, edited: false },
      { key: 'dateExp', label: 'Expiration CNI', value: '03/11/2035', confidence: 97, edited: false },
    ],
    validatorNotes: '',
  },
  {
    id: 'VRF-2026-0003',
    fullName: 'Epse Tchouamou Marie-Claire Fotso',
    phone: '+237 6 55 78 90 12',
    email: 'm.fotso75@gmail.com',
    nationalId: 'YA02 1975 7623409812034',
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
      { key: 'numNational', label: 'N° national CNI', value: 'YA02 1975 7623409812034', confidence: 70, edited: false },
      { key: 'dateNais', label: 'Date naissance', value: '22/03/1975', confidence: 91, edited: false },
      { key: 'lieuNais', label: 'Lieu naissance', value: 'Bafoussam', confidence: 72, edited: false },
      { key: 'dateExp', label: 'Expiration CNI', value: '22/03/2035', confidence: 89, edited: false },
    ],
    validatorNotes: 'NIU non fourni — attestation DGI manquante. Accès limité activé.',
  },
  {
    id: 'VRF-2026-0004',
    fullName: 'Ngono Essomba Patrick',
    phone: '+237 6 21 65 43 87',
    email: 'patrick.ngono@bicec.cm',
    nationalId: 'EB01 1990 4512367809015',
    niuId: 'K567890123456L',
    dateOfBirth: '1990-09-17',
    address: 'Rue Nachtigal, Quartier Nlongkak',
    city: 'Yaoundé',
    region: 'Centre',
    quartier: 'Nlongkak',
    commune: 'Yaoundé II',
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
      { key: 'numNational', label: 'N° national CNI', value: 'EB01 1990 4512367809015', confidence: 99, edited: false },
      { key: 'dateNais', label: 'Date naissance', value: '17/09/1990', confidence: 99, edited: false },
      { key: 'lieuNais', label: 'Lieu naissance', value: 'Ebolowa', confidence: 97, edited: false },
      { key: 'dateExp', label: 'Expiration CNI', value: '17/09/2034', confidence: 99, edited: false },
    ],
    validatorNotes: 'Tous documents conformes. NIU DGI validé. Approuvé.',
  },
  {
    id: 'VRF-2026-0005',
    fullName: 'Bella Njoya Inès',
    phone: '+237 6 88 09 54 32',
    email: 'ines.bella@outlook.com',
    nationalId: 'BU02 1998 3301290045007',
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
      { key: 'numNational', label: 'N° national CNI', value: 'BU02 1998 3301290045007', confidence: 35, edited: false },
      { key: 'dateNais', label: 'Date naissance', value: '05/12/1998', confidence: 38, edited: false },
      { key: 'lieuNais', label: 'Lieu naissance', value: 'Kumba', confidence: 47, edited: false },
      { key: 'dateExp', label: 'Expiration CNI', value: '05/12/2033', confidence: 52, edited: false },
    ],
    validatorNotes: 'Vivacité échouée × 2. Score facial: 42%. Dossier rejeté.',
  },
];
