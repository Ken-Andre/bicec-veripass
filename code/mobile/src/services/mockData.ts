import type {
  OtpSendResponse, OtpVerifyResponse, PinSetupResponse, PinVerifyResponse,
  KycSession, CaptureResult, OcrResult, LivenessResult, LivenessChallenge,
  KycSubmitResponse, Notification, SupportThread, SupportMessage, BankPlan,
  GeoRegion, GeoCity, GeoQuartier, Transaction
} from '../types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const mockAuth = {
  sendOtp: async (): Promise<OtpSendResponse> => {
    await delay(800);
    return { request_id: 'req_' + Date.now(), expires_in: 300 };
  },
  verifyOtp: async (): Promise<OtpVerifyResponse> => {
    await delay(1000);
    return { access_token: 'mock_jwt_token', refresh_token: 'mock_refresh', user_id: 'user_marie_001', is_new_user: true };
  },
  setupPin: async (): Promise<PinSetupResponse> => {
    await delay(600);
    return { success: true };
  },
  verifyPin: async (): Promise<PinVerifyResponse> => {
    await delay(600);
    return { access_token: 'mock_jwt_token', refresh_token: 'mock_refresh' };
  },
};

export const mockKyc = {
  startSession: async (): Promise<KycSession> => {
    await delay(500);
    return {
      session_id: 'ses_' + Date.now(), user_id: 'user_marie_001', status: 'IN_PROGRESS',
      current_step: 'cni_recto', access_level: 'RESTRICTED_ACCESS',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_steps: [],
    };
  },
  captureCni: async (): Promise<CaptureResult> => {
    await delay(1500);
    return { capture_id: 'cap_' + Date.now(), quality_score: 0.92, image_hash: 'sha256_mock', metadata: {} };
  },
  getOcrResult: async (): Promise<OcrResult> => {
    await delay(2000);
    return {
      overall_confidence: 0.87,
      fields: [
        { field_name: 'nom', value: 'NGUEMO', confidence: 0.95, editable: false },
        { field_name: 'prenom', value: 'Marie Claire', confidence: 0.92, editable: false },
        { field_name: 'date_naissance', value: '15/03/1992', confidence: 0.88, editable: true },
        { field_name: 'lieu_naissance', value: 'Douala', confidence: 0.72, editable: true },
        { field_name: 'numero_cni', value: '123456789', confidence: 0.96, editable: false },
        { field_name: 'date_expiration', value: '15/03/2032', confidence: 0.45, editable: true },
      ],
    };
  },
  getLivenessChallenges: (): LivenessChallenge[] => [
    { challenge_type: 'smile', instruction_fr: 'Souriez naturellement', instruction_en: 'Smile naturally' },
    { challenge_type: 'blink', instruction_fr: 'Clignez des yeux', instruction_en: 'Blink your eyes' },
    { challenge_type: 'turn_left', instruction_fr: 'Tournez la tête à gauche', instruction_en: 'Turn your head left' },
  ],
  submitLiveness: async (): Promise<LivenessResult> => {
    await delay(2000);
    return { is_alive: true, confidence: 0.94, attempts_remaining: 2, face_match_score: 0.92, strikes_remaining: 3 };
  },
  submitAddress: async (): Promise<{ success: boolean }> => {
    await delay(800);
    return { success: true };
  },
  captureBill: async (): Promise<CaptureResult> => {
    await delay(1200);
    return { capture_id: 'bill_' + Date.now(), quality_score: 0.85, image_hash: 'sha256_bill', metadata: {} };
  },
  captureNiu: async (): Promise<CaptureResult> => {
    await delay(1000);
    return { capture_id: 'niu_' + Date.now(), quality_score: 0.90, image_hash: 'sha256_niu', metadata: {} };
  },
  submit: async (): Promise<KycSubmitResponse> => {
    await delay(2000);
    return { submission_id: 'sub_' + Date.now(), status: 'SUBMITTED', estimated_review_time: '24-48h' };
  },
};

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'GENERAL', title: 'Bienvenue chez BICEC', message: 'Votre parcours KYC a bien démarré.', read: false, created_at: new Date().toISOString() },
  { id: 'n2', type: 'DOSSIER_APPROVED', title: 'Dossier approuvé !', message: 'Votre identité a été vérifiée avec succès.', read: false, created_at: new Date(Date.now() - 86400000).toISOString() },
];

export const mockSupport = {
  threads: [
    { id: 't1', subject: 'Question sur mon dossier KYC', status: 'open' as const, created_at: new Date().toISOString(), last_message_at: new Date().toISOString() },
  ] satisfies SupportThread[],
  messages: [
    { id: 'm1', thread_id: 't1', sender: 'user' as const, content: 'Bonjour, quand mon dossier sera-t-il validé ?', created_at: new Date().toISOString() },
    { id: 'm2', thread_id: 't1', sender: 'agent' as const, content: 'Bonjour Marie, votre dossier est en cours de traitement. Comptez 24 à 48h.', created_at: new Date(Date.now() + 3600000).toISOString() },
  ] satisfies SupportMessage[],
};

export const mockPlans: BankPlan[] = [
  { id: 'standard', name: 'Standard', tier: 'standard', monthly_fee: 0, features: ['Compte courant', 'Carte de débit virtuelle', 'Virements nationaux', 'Application mobile'] },
  { id: 'premium', name: 'Premium', tier: 'premium', monthly_fee: 5000, features: ['Tout Standard +', 'Carte physique Visa', 'Virements internationaux', 'Assurance voyage', 'Support prioritaire'], recommended: true },
  { id: 'ultra', name: 'Ultra', tier: 'ultra', monthly_fee: 15000, features: ['Tout Premium +', 'Carte Visa Gold', 'Cashback 2%', 'Conciergerie', 'Lounge aéroport', 'Conseiller dédié'] },
];

export const mockGeo = {
  regions: [
    { code: 'CE', name: 'Centre' }, { code: 'LT', name: 'Littoral' },
    { code: 'OU', name: 'Ouest' }, { code: 'SU', name: 'Sud' },
    { code: 'NO', name: 'Nord' }, { code: 'EN', name: 'Extrême-Nord' },
    { code: 'AD', name: 'Adamaoua' }, { code: 'ES', name: 'Est' },
    { code: 'NW', name: 'Nord-Ouest' }, { code: 'SW', name: 'Sud-Ouest' },
  ] satisfies GeoRegion[],

  cities: [
    { code: 'YDE', name: 'Yaoundé', region_code: 'CE' },
    { code: 'MBA', name: 'Mbalmayo', region_code: 'CE' },
    { code: 'OBA', name: 'Obala', region_code: 'CE' },
    { code: 'DLA', name: 'Douala', region_code: 'LT' },
    { code: 'EDA', name: 'Edéa', region_code: 'LT' },
    { code: 'NKG', name: 'Nkongsamba', region_code: 'LT' },
    { code: 'LOM', name: 'Loum', region_code: 'LT' },
    { code: 'BFM', name: 'Bafoussam', region_code: 'OU' },
    { code: 'DSG', name: 'Dschang', region_code: 'OU' },
    { code: 'MDA', name: 'Mbouda', region_code: 'OU' },
    { code: 'FBN', name: 'Foumban', region_code: 'OU' },
    { code: 'BDA', name: 'Bamenda', region_code: 'NW' },
    { code: 'KBA', name: 'Kumbo', region_code: 'NW' },
    { code: 'BUE', name: 'Buéa', region_code: 'SW' },
    { code: 'LBE', name: 'Limbé', region_code: 'SW' },
    { code: 'KUM', name: 'Kumba', region_code: 'SW' },
    { code: 'GRA', name: 'Garoua', region_code: 'NO' },
    { code: 'MRA', name: 'Maroua', region_code: 'EN' },
    { code: 'KSL', name: 'Kousséri', region_code: 'EN' },
    { code: 'NGD', name: 'Ngaoundéré', region_code: 'AD' },
    { code: 'BTA', name: 'Bertoua', region_code: 'ES' },
    { code: 'EBW', name: 'Ebolowa', region_code: 'SU' },
    { code: 'KRI', name: 'Kribi', region_code: 'SU' },
    { code: 'SGA', name: 'Sangmélima', region_code: 'SU' },
  ] satisfies GeoCity[],

  quartiers: [
    // YAOUNDÉ
    { code: 'BAS', name: 'Bastos', city_code: 'YDE', commune_name: 'Yaoundé 1er' },
    { code: 'NLG', name: 'Nlongkak', city_code: 'YDE', commune_name: 'Yaoundé 1er' },
    { code: 'TSG', name: 'Tsinga', city_code: 'YDE', commune_name: 'Yaoundé 1er' },
    { code: 'EMK', name: 'Etoa-Meki', city_code: 'YDE', commune_name: 'Yaoundé 1er' },
    { code: 'MFD', name: 'Mfandena', city_code: 'YDE', commune_name: 'Yaoundé 1er' },
    { code: 'MVG', name: 'Mvog-Mbi', city_code: 'YDE', commune_name: 'Yaoundé 2e' },
    { code: 'MKL', name: 'Mokolo', city_code: 'YDE', commune_name: 'Yaoundé 2e' },
    { code: 'CIT', name: 'Cité Verte', city_code: 'YDE', commune_name: 'Yaoundé 2e' },
    { code: 'NSM', name: 'Nsam', city_code: 'YDE', commune_name: 'Yaoundé 3e' },
    { code: 'OMS', name: 'Omnisports', city_code: 'YDE', commune_name: 'Yaoundé 3e' },
    { code: 'EFO', name: 'Efoulan', city_code: 'YDE', commune_name: 'Yaoundé 3e' },
    { code: 'MBO', name: 'Mimboman', city_code: 'YDE', commune_name: 'Yaoundé 4e' },
    { code: 'KON', name: 'Kondengui', city_code: 'YDE', commune_name: 'Yaoundé 4e' },
    { code: 'EKE', name: 'Ekounou', city_code: 'YDE', commune_name: 'Yaoundé 4e' },
    { code: 'ODA', name: 'Odza', city_code: 'YDE', commune_name: 'Yaoundé 4e' },
    { code: 'NGO', name: 'Ngousso', city_code: 'YDE', commune_name: 'Yaoundé 5e' },
    { code: 'ESS', name: 'Essos', city_code: 'YDE', commune_name: 'Yaoundé 5e' },
    { code: 'NGB', name: 'Ngoulmekong', city_code: 'YDE', commune_name: 'Yaoundé 5e' },
    { code: 'MEL', name: 'Melen', city_code: 'YDE', commune_name: 'Yaoundé 6e' },
    { code: 'BYA', name: 'Biyem-Assi', city_code: 'YDE', commune_name: 'Yaoundé 6e' },
    { code: 'MDS', name: 'Mendong', city_code: 'YDE', commune_name: 'Yaoundé 6e' },
    { code: 'ETO', name: 'Etoug-Ebe', city_code: 'YDE', commune_name: 'Yaoundé 6e' },
    { code: 'NKB', name: 'Nkolbisson', city_code: 'YDE', commune_name: 'Yaoundé 7e' },
    { code: 'OYO', name: 'Oyom-Abang', city_code: 'YDE', commune_name: 'Yaoundé 7e' },
    // DOUALA
    { code: 'AKW', name: 'Akwa', city_code: 'DLA', commune_name: 'Douala 1er' },
    { code: 'DEI', name: 'Deido', city_code: 'DLA', commune_name: 'Douala 1er' },
    { code: 'BPR', name: 'Bonapriso', city_code: 'DLA', commune_name: 'Douala 1er' },
    { code: 'BON', name: 'Bonanjo', city_code: 'DLA', commune_name: 'Douala 1er' },
    { code: 'NBL', name: 'New Bell', city_code: 'DLA', commune_name: 'Douala 2e' },
    { code: 'VLG', name: 'Village', city_code: 'DLA', commune_name: 'Douala 2e' },
    { code: 'NGG', name: 'Nkongmondo', city_code: 'DLA', commune_name: 'Douala 2e' },
    { code: 'NDK', name: 'Ndokoti', city_code: 'DLA', commune_name: 'Douala 3e' },
    { code: 'KOT', name: 'Kotto', city_code: 'DLA', commune_name: 'Douala 3e' },
    { code: 'LOG', name: 'Logpom', city_code: 'DLA', commune_name: 'Douala 3e' },
    { code: 'YAS', name: 'Yassa', city_code: 'DLA', commune_name: 'Douala 3e' },
    { code: 'BNB', name: 'Bonabéri', city_code: 'DLA', commune_name: 'Douala 4e' },
    { code: 'BNS', name: 'Bonassama', city_code: 'DLA', commune_name: 'Douala 4e' },
    { code: 'BMS', name: 'Bonamoussadi', city_code: 'DLA', commune_name: 'Douala 5e' },
    { code: 'MKP', name: 'Makepe', city_code: 'DLA', commune_name: 'Douala 5e' },
    { code: 'BPD', name: 'Bépanda', city_code: 'DLA', commune_name: 'Douala 5e' },
    { code: 'LGB', name: 'Logbessou', city_code: 'DLA', commune_name: 'Douala 5e' },
    { code: 'KMS', name: 'Kotto-Bass', city_code: 'DLA', commune_name: 'Douala 5e' },
    // BAFOUSSAM
    { code: 'TGI', name: 'Tamdja', city_code: 'BFM', commune_name: 'Bafoussam 1er' },
    { code: 'DJE', name: 'Djemoun', city_code: 'BFM', commune_name: 'Bafoussam 1er' },
    { code: 'KAM', name: 'Kamkop', city_code: 'BFM', commune_name: 'Bafoussam 2e' },
    { code: 'BAM', name: 'Bamougoum', city_code: 'BFM', commune_name: 'Bafoussam 2e' },
    { code: 'TOU', name: 'Tougang', city_code: 'BFM', commune_name: 'Bafoussam 3e' },
    { code: 'NDZ', name: 'Ndiangdam', city_code: 'BFM', commune_name: 'Bafoussam 3e' },
    // BAMENDA
    { code: 'NKW', name: 'Nkwen', city_code: 'BDA', commune_name: 'Bamenda 2e' },
    { code: 'MNK', name: 'Mankon', city_code: 'BDA', commune_name: 'Bamenda 1er' },
    { code: 'UPT', name: 'Up Station', city_code: 'BDA', commune_name: 'Bamenda 1er' },
    { code: 'OLD', name: 'Old Town', city_code: 'BDA', commune_name: 'Bamenda 2e' },
    { code: 'NTB', name: 'Ntarinkon', city_code: 'BDA', commune_name: 'Bamenda 3e' },
    // Other cities quartiers
    { code: 'ROP', name: 'Roupay', city_code: 'GRA', commune_name: 'Garoua 1er' },
    { code: 'DGR', name: 'Domayo', city_code: 'MRA', commune_name: 'Maroua 1er' },
    { code: 'JOL', name: 'Joli Soir', city_code: 'NGD', commune_name: 'Ngaoundéré 1er' },
    { code: 'HAU', name: 'Haoussa', city_code: 'BTA', commune_name: 'Bertoua 1er' },
    { code: 'ANG', name: 'Angalé', city_code: 'EBW', commune_name: 'Ebolowa 1er' },
    { code: 'CEN', name: 'Centre-ville', city_code: 'KRI', commune_name: 'Kribi 1er' },
    { code: 'MOL', name: 'Molyko', city_code: 'BUE', commune_name: 'Buéa' },
    { code: 'DWN', name: 'Down Beach', city_code: 'LBE', commune_name: 'Limbé 1er' },
    { code: 'FIT', name: 'Fiango', city_code: 'KUM', commune_name: 'Kumba 1er' },
    { code: 'FCK', name: 'Foto', city_code: 'DSG', commune_name: 'Dschang' },
    { code: 'NJI', name: 'Njinka', city_code: 'FBN', commune_name: 'Foumban' },
    { code: 'EDB', name: 'Edéa-Bassa', city_code: 'EDA', commune_name: 'Edéa 1er' },
    { code: 'NKS', name: 'Nkongsamba Centre', city_code: 'NKG', commune_name: 'Nkongsamba 1er' },
    { code: 'LMC', name: 'Loum Centre', city_code: 'LOM', commune_name: 'Loum' },
    { code: 'TOB', name: 'Tobin', city_code: 'KBA', commune_name: 'Kumbo' },
    { code: 'KSC', name: 'Kousséri Centre', city_code: 'KSL', commune_name: 'Kousséri' },
    { code: 'MBC', name: 'Mbalmayo Centre', city_code: 'MBA', commune_name: 'Mbalmayo' },
    { code: 'OBC', name: 'Obala Centre', city_code: 'OBA', commune_name: 'Obala' },
    { code: 'SGC', name: 'Sangmélima Centre', city_code: 'SGA', commune_name: 'Sangmélima' },
  ] satisfies GeoQuartier[],
};

const now = Date.now();
const day = 86400000;

export const mockTransactions: Transaction[] = [
  { id: 'tx1', type: 'credit', label: 'Salaire Décembre', amount: 250000, date: new Date(now - 2 * day).toISOString(), category: 'salary', counterparty: 'SABC' },
  { id: 'tx2', type: 'debit', label: 'Recharge MTN', amount: -5000, date: new Date(now - 2 * day).toISOString(), category: 'mobile_recharge', counterparty: 'MTN MoMo' },
  { id: 'tx3', type: 'debit', label: 'Paiement ENEO', amount: -15000, date: new Date(now - 3 * day).toISOString(), category: 'bill_payment', counterparty: 'ENEO Cameroun' },
  { id: 'tx4', type: 'debit', label: 'Supermarché Mahima', amount: -23500, date: new Date(now - 4 * day).toISOString(), category: 'purchase', counterparty: 'Mahima Supermarket' },
  { id: 'tx5', type: 'debit', label: 'Virement à Paul', amount: -30000, date: new Date(now - 5 * day).toISOString(), category: 'transfer_out', counterparty: 'NGUEMO Paul' },
  { id: 'tx6', type: 'credit', label: 'Remboursement', amount: 10000, date: new Date(now - 5 * day).toISOString(), category: 'transfer_in', counterparty: 'FOTSO Jean' },
  { id: 'tx7', type: 'debit', label: 'Recharge Orange', amount: -3000, date: new Date(now - 6 * day).toISOString(), category: 'mobile_recharge', counterparty: 'Orange Money' },
  { id: 'tx8', type: 'debit', label: 'Paiement CAMWATER', amount: -8000, date: new Date(now - 7 * day).toISOString(), category: 'bill_payment', counterparty: 'CAMWATER' },
  { id: 'tx9', type: 'credit', label: 'Virement reçu', amount: 45000, date: new Date(now - 8 * day).toISOString(), category: 'transfer_in', counterparty: 'KAMGA Alain' },
  { id: 'tx10', type: 'debit', label: 'Taxi', amount: -2000, date: new Date(now - 8 * day).toISOString(), category: 'purchase', counterparty: 'Transport' },
  { id: 'tx11', type: 'debit', label: 'Restaurant Le Marrakech', amount: -7500, date: new Date(now - 9 * day).toISOString(), category: 'purchase', counterparty: 'Le Marrakech' },
  { id: 'tx12', type: 'debit', label: 'Virement Mobile Money', amount: -20000, date: new Date(now - 10 * day).toISOString(), category: 'transfer_out', counterparty: 'TCHAMDA Anne' },
  { id: 'tx13', type: 'credit', label: 'Prime de fin d\'année', amount: 100000, date: new Date(now - 12 * day).toISOString(), category: 'salary', counterparty: 'SABC' },
  { id: 'tx14', type: 'debit', label: 'Pharmacie du Centre', amount: -4500, date: new Date(now - 13 * day).toISOString(), category: 'purchase', counterparty: 'Pharmacie Centre' },
  { id: 'tx15', type: 'debit', label: 'Abonnement Canal+', amount: -10000, date: new Date(now - 14 * day).toISOString(), category: 'bill_payment', counterparty: 'Canal+ Cameroun' },
];