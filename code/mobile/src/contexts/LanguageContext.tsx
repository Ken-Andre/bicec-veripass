import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Language } from '../types';

const translations: Record<string, Record<Language, string>> = {
  // Welcome & Splash
  'welcome.title': { fr: 'Bienvenue chez BICEC', en: 'Welcome to BICEC' },
  'welcome.subtitle': { fr: 'Votre banque digitale, simplifiée', en: 'Your digital bank, simplified' },
  'welcome.cta': { fr: 'Commencer', en: 'Get Started' },
  'welcome.speed': { fr: 'Rapidité', en: 'Speed' },
  'welcome.speed.desc': { fr: 'Ouvrez votre compte en 15 minutes', en: 'Open your account in 15 minutes' },
  'welcome.security': { fr: 'Sécurité', en: 'Security' },
  'welcome.security.desc': { fr: 'Vos données sont protégées', en: 'Your data is protected' },
  'welcome.modernity': { fr: 'Modernité', en: 'Modernity' },
  'welcome.modernity.desc': { fr: 'Une expérience 100% digitale', en: 'A 100% digital experience' },

  // Auth
  'auth.phone.title': { fr: 'Votre numéro de téléphone', en: 'Your phone number' },
  'auth.phone.subtitle': { fr: 'Nous vous enverrons un code de vérification', en: "We'll send you a verification code" },
  'auth.otp.title': { fr: 'Vérification', en: 'Verification' },
  'auth.otp.subtitle': { fr: 'Entrez le code reçu par SMS', en: 'Enter the code received by SMS' },
  'auth.otp.resend': { fr: 'Renvoyer le code', en: 'Resend code' },
  'auth.otp.resend.timer': { fr: 'Renvoyer dans', en: 'Resend in' },
  'auth.email.title': { fr: 'Votre adresse email', en: 'Your email address' },
  'auth.email.subtitle': { fr: 'Pour sécuriser votre compte', en: 'To secure your account' },
  'auth.email.verify.title': { fr: 'Vérification email', en: 'Email verification' },
  'auth.email.verify.subtitle': { fr: 'Entrez le code envoyé à votre email', en: 'Enter the code sent to your email' },
  'auth.pin.title': { fr: 'Créez votre code PIN', en: 'Create your PIN code' },
  'auth.pin.subtitle': { fr: '6 chiffres pour sécuriser votre accès', en: '6 digits to secure your access' },
  'auth.pin.confirm': { fr: 'Confirmez votre code PIN', en: 'Confirm your PIN code' },
  'auth.pin.mismatch': { fr: 'Les codes PIN ne correspondent pas', en: 'PIN codes do not match' },
  'auth.biometric.title': { fr: 'Connexion rapide', en: 'Quick login' },
  'auth.biometric.subtitle': { fr: 'Activez la biométrie pour un accès instantané', en: 'Enable biometrics for instant access' },
  'auth.biometric.skip': { fr: 'Plus tard', en: 'Later' },
  'auth.biometric.enable': { fr: 'Activer', en: 'Enable' },
  'auth.biometric.fingerprint': { fr: 'Empreinte digitale', en: 'Fingerprint' },
  'auth.biometric.face': { fr: 'Reconnaissance faciale', en: 'Face recognition' },
  'auth.biometric.unsupported': { fr: 'Non supporté', en: 'Not supported' },
  'auth.biometric.failed': { fr: 'Enregistrement biométrique échoué', en: 'Biometric registration failed' },

  // PIN Login
  'pinLogin.title': { fr: 'Bon retour !', en: 'Welcome back!' },
  'pinLogin.subtitle': { fr: 'Entrez votre code PIN pour accéder à votre compte', en: 'Enter your PIN to access your account' },
  'pinLogin.error': { fr: 'Code PIN incorrect', en: 'Incorrect PIN' },
  'pinLogin.remaining': { fr: 'essais restants', en: 'attempts remaining' },
  'pinLogin.blocked': { fr: 'Compte bloqué. Veuillez vous reconnecter par OTP.', en: 'Account blocked. Please reconnect via OTP.' },
  'pinLogin.forgot': { fr: 'Code PIN oublié ?', en: 'Forgot PIN?' },
  'pinLogin.biometric': { fr: 'Utiliser la biométrie', en: 'Use biometrics' },

  // KYC What You Need
  'kyc.whatYouNeed.title': { fr: 'Ce dont vous avez besoin', en: 'What you need' },
  'kyc.whatYouNeed.time': { fr: '~15 minutes', en: '~15 minutes' },
  'kyc.whatYouNeed.cni': { fr: 'Carte Nationale d\'Identité', en: 'National ID Card' },
  'kyc.whatYouNeed.selfie': { fr: 'Un selfie rapide', en: 'A quick selfie' },
  'kyc.whatYouNeed.address': { fr: 'Justificatif de domicile', en: 'Proof of address' },
  'kyc.whatYouNeed.niu': { fr: 'Numéro NIU (optionnel)', en: 'NIU number (optional)' },
  'kyc.whatYouNeed.ready': { fr: 'Tout est prêt ? C\'est parti !', en: 'All set? Let\'s go!' },

  // KYC Progress
  'kyc.progress.title': { fr: 'Étapes de vérification', en: 'Verification steps' },
  'kyc.progress.identity': { fr: 'Identité', en: 'Identity' },
  'kyc.progress.address': { fr: 'Adresse', en: 'Address' },
  'kyc.progress.consent': { fr: 'Consentement', en: 'Consent' },
  'kyc.progress.submission': { fr: 'Soumission', en: 'Submission' },
  'kyc.progress.identity.desc': { fr: 'CNI + Selfie de vérification', en: 'ID Card + Verification selfie' },
  'kyc.progress.address.desc': { fr: 'Adresse + Justificatif', en: 'Address + Proof' },
  'kyc.progress.consent.desc': { fr: 'Consentement + Signature', en: 'Consent + Signature' },
  'kyc.progress.submission.desc': { fr: 'Envoi sécurisé du dossier', en: 'Secure application upload' },

  // CNI
  'cni.intro.title': { fr: 'Votre pièce d\'identité', en: 'Your ID card' },
  'cni.intro.why': { fr: 'Nous en avons besoin pour vérifier votre identité conformément à la réglementation COBAC.', en: 'We need this to verify your identity in accordance with COBAC regulations.' },
  'cni.intro.secure': { fr: 'Données chiffrées & sécurisées', en: 'Encrypted & secure data' },
  'cni.recto.title': { fr: 'Recto de la CNI', en: 'Front of ID card' },
  'cni.recto.tip': { fr: 'Placez le recto de votre CNI dans le cadre', en: 'Place the front of your ID card in the frame' },
  'cni.verso.title': { fr: 'Verso de la CNI', en: 'Back of ID card' },
  'cni.verso.tip': { fr: 'Retournez votre CNI et placez le verso dans le cadre', en: 'Flip your ID card and place the back in the frame' },
  'cni.verso.flip': { fr: 'Retournez votre CNI', en: 'Flip your ID card' },

  // Capture
  'capture.success': { fr: 'Capture réussie !', en: 'Capture successful!' },
  'capture.open.camera': { fr: 'Ouvrir la caméra', en: 'Open camera' },
  'capture.camera.error': { fr: 'Impossible d\'accéder à la caméra. Veuillez autoriser l\'accès.', en: 'Unable to access camera. Please allow access.' },
  'capture.quality.good': { fr: '✓ Bonne qualité — capture auto...', en: '✓ Good quality — auto capture...' },
  'capture.quality.adjust': { fr: '⚠ Ajustez la position', en: '⚠ Adjust position' },
  'capture.quality.analyzing': { fr: 'Analyse...', en: 'Analyzing...' },
  'capture.tip.light': { fr: 'Bonne luminosité, évitez les reflets', en: 'Good lighting, avoid reflections' },
  'capture.tip.steady': { fr: 'Tenez fermement, évitez le flou', en: 'Hold steady, avoid blur' },
  'capture.tip.align': { fr: 'Alignez la carte dans le cadre', en: 'Align the card in the frame' },
  'capture.manual': { fr: '📸 Capturer maintenant', en: '📸 Capture now' },
  'capture.quality.blurry': { fr: '⚠ Image floue', en: '⚠ Blurry image' },
  'capture.quality.dark': { fr: '⚠ Trop sombre', en: '⚠ Too dark' },
  'capture.quality.glare': { fr: '⚠ Reflets détectés', en: '⚠ Glare detected' },

  // OCR
  'ocr.processing': { fr: 'Analyse en cours...', en: 'Processing...' },
  'ocr.processing.subtitle': { fr: 'Extraction des informations de votre CNI', en: 'Extracting information from your ID card' },
  'ocr.review.title': { fr: 'Vérifiez vos informations', en: 'Verify your information' },

  // Liveness
  'liveness.intro.title': { fr: 'Selfie rapide', en: 'Quick selfie' },
  'liveness.intro.subtitle': { fr: 'Pour confirmer que c\'est bien vous', en: 'To confirm it\'s really you' },
  'liveness.intro.privacy': { fr: 'Votre selfie est traité de manière sécurisée et ne sera pas stocké.', en: 'Your selfie is processed securely and will not be stored.' },
  'liveness.success': { fr: 'Identité vérifiée !', en: 'Identity verified!' },
  'liveness.fail.title': { fr: 'Vérification échouée', en: 'Verification failed' },
  'liveness.fail.message': { fr: 'La vérification biométrique a échoué après 3 tentatives. Veuillez réessayer.', en: 'Biometric verification failed after 3 attempts. Please try again.' },
  'liveness.fail.retry': { fr: 'Recommencer', en: 'Try again' },
  'liveness.camera.error': { fr: 'Impossible d\'accéder à la caméra frontale', en: 'Unable to access front camera' },
  'liveness.face.not_detected': { fr: 'Placez votre visage dans l\'ovale', en: 'Place your face in the oval' },
  'liveness.challenge.progress': { fr: 'Maintenez la pose...', en: 'Hold the pose...' },
  'liveness.loading.model': { fr: 'Chargement du modèle...', en: 'Loading model...' },

  // Address
  'address.title': { fr: 'Votre adresse', en: 'Your address' },
  'address.region': { fr: 'Région', en: 'Region' },
  'address.city': { fr: 'Ville', en: 'City' },
  'address.commune': { fr: 'Commune / Arrondissement', en: 'District / Sub-division' },
  'address.quartier': { fr: 'Quartier', en: 'Neighborhood' },
  'address.lieuDit': { fr: 'Lieu-dit (optionnel)', en: 'Landmark (optional)' },
  'address.gps': { fr: 'Utiliser ma position GPS', en: 'Use my GPS location' },
  'address.gps.notice': { fr: 'Votre position sera utilisée uniquement pour pré-remplir votre adresse.', en: 'Your location will only be used to pre-fill your address.' },

  // Utility
  'utility.title': { fr: 'Justificatif de domicile', en: 'Proof of address' },
  'utility.subtitle': { fr: 'Photographiez votre dernière facture pour justifier votre domicile.', en: 'Take a photo of your latest bill to verify your address.' },
  'utility.eneo': { fr: 'ENEO (Électricité)', en: 'ENEO (Electricity)' },
  'utility.camwater': { fr: 'CAMWATER (Eau)', en: 'CAMWATER (Water)' },

  // NIU
  'niu.title': { fr: 'Numéro d\'Identifiant Unique', en: 'Unique Identifier Number' },
  'niu.skip.warning': { fr: 'Sans NIU, votre compte sera en accès limité.', en: 'Without NIU, your account will have limited access.' },
  'niu.upload': { fr: 'Photographier mon attestation NIU', en: 'Take a photo of my NIU certificate' },
  'niu.manual': { fr: 'Saisir mon numéro manuellement', en: 'Enter my number manually' },
  'niu.skip': { fr: 'Passer cette étape', en: 'Skip this step' },
  'niu.enter': { fr: 'Saisissez votre Numéro d\'Identifiant Unique (NIU)', en: 'Enter your Unique Identifier Number (NIU)' },
  'niu.format.hint': { fr: 'Format: M suivi de 10-14 chiffres', en: 'Format: M followed by 10-14 digits' },

  // Consent
  'consent.title': { fr: 'Consentement', en: 'Consent' },
  'consent.cgu': { fr: 'J\'accepte les Conditions Générales d\'Utilisation', en: 'I accept the Terms of Service' },
  'consent.privacy': { fr: 'J\'accepte la Politique de Confidentialité', en: 'I accept the Privacy Policy' },
  'consent.data': { fr: 'J\'autorise le traitement de mes données personnelles', en: 'I authorize the processing of my personal data' },
  'consent.readDoc': { fr: 'Lire le document', en: 'Read the document' },
  'consent.submit': { fr: 'Soumettre', en: 'Submit' },

  // Signature
  'signature.title': { fr: 'Signature digitale', en: 'Digital signature' },
  'signature.instruction': { fr: 'Signez dans le cadre ci-dessous', en: 'Sign in the box below' },
  'signature.clear': { fr: 'Effacer', en: 'Clear' },

  // Review
  'review.title': { fr: 'Récapitulatif', en: 'Summary' },
  'review.submit': { fr: 'Soumettre mon dossier', en: 'Submit my application' },
  'review.identity': { fr: 'Identité', en: 'Identity' },
  'review.address': { fr: 'Adresse', en: 'Address' },
  'review.documents': { fr: 'Documents', en: 'Documents' },
  'review.consent': { fr: 'Consentement', en: 'Consent' },
  'review.bill.yes': { fr: '✓ Facture', en: '✓ Bill' },
  'review.bill.no': { fr: '✗ Facture', en: '✗ Bill' },
  'review.niu.yes': { fr: '✓ NIU', en: '✓ NIU' },
  'review.niu.no': { fr: '⚠ NIU non fourni', en: '⚠ NIU not provided' },
  'review.consent.cgu': { fr: '✓ CGU acceptées', en: '✓ Terms accepted' },
  'review.consent.privacy': { fr: '✓ Politique de confidentialité', en: '✓ Privacy policy' },
  'review.consent.data': { fr: '✓ Traitement des données', en: '✓ Data processing' },

  // Upload
  'upload.title': { fr: 'Envoi sécurisé', en: 'Secure upload' },
  'upload.subtitle': { fr: 'Envoi chiffré de vos documents...', en: 'Encrypted upload of your documents...' },

  // Celebration
  'celebration.title': { fr: 'Félicitations !', en: 'Congratulations!' },
  'celebration.message': { fr: 'Votre dossier BICEC a été soumis avec succès.', en: 'Your BICEC application has been submitted successfully.' },

  // Plans & Discovery
  'plans.title': { fr: 'Choisissez votre formule', en: 'Choose your plan' },
  'plans.recommended': { fr: 'Recommandé', en: 'Recommended' },
  'personalization.title': { fr: 'Vos centres d\'intérêt', en: 'Your interests' },

  // Dashboard
  'dashboard.restricted.banner': { fr: '⏳ En cours de validation', en: '⏳ Under review' },
  'dashboard.limited.banner': { fr: '⚠️ Complétez votre NIU pour un accès complet', en: '⚠️ Complete your NIU for full access' },
  'dashboard.balance': { fr: 'Solde disponible', en: 'Available balance' },

  // Nav
  'nav.home': { fr: 'Accueil', en: 'Home' },
  'nav.cards': { fr: 'Cartes', en: 'Cards' },
  'nav.transfers': { fr: 'Transferts', en: 'Transfers' },
  'nav.more': { fr: 'Plus', en: 'More' },

  // Transfers
  'transfer.send.title': { fr: 'Envoyer', en: 'Send' },
  'transfer.send.desc': { fr: 'Vers un compte BICEC ou mobile money', en: 'To a BICEC account or mobile money' },
  'transfer.send.chooseType': { fr: 'Choisissez le type de transfert', en: 'Choose transfer type' },
  'transfer.send.bicec': { fr: 'Compte BICEC', en: 'BICEC Account' },
  'transfer.send.bicecDesc': { fr: 'Virement vers un autre compte BICEC', en: 'Transfer to another BICEC account' },
  'transfer.send.mobile': { fr: 'Mobile Money', en: 'Mobile Money' },
  'transfer.send.mobileDesc': { fr: 'MTN MoMo, Orange Money', en: 'MTN MoMo, Orange Money' },
  'transfer.send.accountNumber': { fr: 'Numéro de compte', en: 'Account number' },
  'transfer.send.phoneNumber': { fr: 'Numéro de téléphone', en: 'Phone number' },
  'transfer.send.amount': { fr: 'Montant', en: 'Amount' },
  'transfer.send.motif': { fr: 'Motif (optionnel)', en: 'Reason (optional)' },
  'transfer.send.motifPlaceholder': { fr: 'Ex: Loyer, remboursement...', en: 'E.g.: Rent, reimbursement...' },
  'transfer.send.summary': { fr: 'Récapitulatif', en: 'Summary' },
  'transfer.send.to': { fr: 'Destinataire', en: 'Recipient' },
  'transfer.send.fees': { fr: 'Frais', en: 'Fees' },
  'transfer.send.enterPin': { fr: 'Entrez votre PIN pour confirmer', en: 'Enter your PIN to confirm' },
  'transfer.success.title': { fr: 'Transfert effectué !', en: 'Transfer complete!' },
  'transfer.success.ref': { fr: 'Réf:', en: 'Ref:' },
  'transfer.success.back': { fr: 'Retour à l\'accueil', en: 'Back to home' },
  'transfer.recurring': { fr: 'Virements récurrents', en: 'Recurring transfers' },
  'transfer.recurringDesc': { fr: 'Programmez vos transferts automatiques', en: 'Schedule your automatic transfers' },

  // Receive
  'receive.title': { fr: 'Recevoir', en: 'Receive' },
  'receive.desc': { fr: 'Partagez vos coordonnées bancaires', en: 'Share your bank details' },
  'receive.holder': { fr: 'Titulaire', en: 'Account holder' },
  'receive.bankCode': { fr: 'Code banque', en: 'Bank code' },
  'receive.branchCode': { fr: 'Code agence', en: 'Branch code' },
  'receive.accountNumber': { fr: 'N° de compte', en: 'Account number' },
  'receive.key': { fr: 'Clé RIB', en: 'RIB key' },
  'receive.scanQr': { fr: 'Scannez pour recevoir un paiement', en: 'Scan to receive a payment' },
  'receive.copyIban': { fr: 'Copier l\'IBAN complet', en: 'Copy full IBAN' },

  // Cards
  'cards.freeze': { fr: 'Geler', en: 'Freeze' },
  'cards.frozen': { fr: 'Carte gelée', en: 'Card frozen' },
  'cards.frozenDesc': { fr: 'Votre carte est temporairement bloquée', en: 'Your card is temporarily blocked' },
  'cards.freezeDesc': { fr: 'Bloquez temporairement votre carte', en: 'Temporarily block your card' },
  'cards.show': { fr: 'Voir détails', en: 'Show details' },
  'cards.hide': { fr: 'Masquer', en: 'Hide' },
  'cards.copy': { fr: 'Copier', en: 'Copy' },
  'cards.findAtm': { fr: 'Trouver un GAB', en: 'Find ATM' },
  'cards.findAtmDesc': { fr: 'Distributeurs BICEC à proximité', en: 'Nearby BICEC ATMs' },

  // Savings
  'savings.title': { fr: 'Épargne', en: 'Savings' },
  'savings.total': { fr: 'Épargne totale', en: 'Total savings' },
  'savings.pockets': { fr: 'Mes poches', en: 'My pockets' },
  'savings.create': { fr: 'Nouvelle poche', en: 'New pocket' },
  'savings.newPocket': { fr: 'Créer une poche', en: 'Create a pocket' },
  'savings.pocketName': { fr: 'Nom de la poche', en: 'Pocket name' },
  'savings.goal': { fr: 'Objectif', en: 'Goal' },
  'savings.initialAmount': { fr: 'Montant initial (optionnel)', en: 'Initial amount (optional)' },
  'savings.createBtn': { fr: 'Créer', en: 'Create' },
  'savings.tip': { fr: 'Astuce : épargnez régulièrement de petites sommes pour atteindre vos objectifs plus vite !', en: 'Tip: save small amounts regularly to reach your goals faster!' },

  // Transactions
  'transactions.title': { fr: 'Historique', en: 'History' },
  'transactions.filter.all': { fr: 'Tout', en: 'All' },
  'transactions.filter.in': { fr: 'Entrées', en: 'Income' },
  'transactions.filter.out': { fr: 'Sorties', en: 'Expenses' },

  // Settings
  'settings.title': { fr: 'Paramètres', en: 'Settings' },
  'settings.language': { fr: 'Langue', en: 'Language' },
  'settings.preferences': { fr: 'Préférences', en: 'Preferences' },
  'settings.security': { fr: 'Sécurité', en: 'Security' },
  'settings.biometric': { fr: 'Biométrie', en: 'Biometrics' },
  'settings.notifications': { fr: 'Notifications push', en: 'Push notifications' },
  'settings.darkMode': { fr: 'Mode sombre', en: 'Dark mode' },
  'settings.changePin': { fr: 'Changer le code PIN', en: 'Change PIN code' },
  'settings.privacy': { fr: 'Confidentialité', en: 'Privacy' },

  // Help
  'help.title': { fr: 'Aide', en: 'Help' },
  'help.cardEmergency': { fr: 'Urgence carte', en: 'Card emergency' },
  'help.cardEmergencyDesc': { fr: 'Perte, vol ou utilisation frauduleuse', en: 'Loss, theft or fraudulent use' },
  'help.faqTitle': { fr: 'Questions fréquentes', en: 'Frequently asked questions' },
  'help.faq1.q': { fr: 'Comment ouvrir un compte BICEC ?', en: 'How to open a BICEC account?' },
  'help.faq1.a': { fr: 'Téléchargez l\'application VeriPass, suivez le parcours KYC et soumettez vos documents. Votre compte sera activé sous 24-48h.', en: 'Download the VeriPass app, follow the KYC process and submit your documents. Your account will be activated within 24-48h.' },
  'help.faq2.q': { fr: 'Quels documents sont nécessaires ?', en: 'What documents are required?' },
  'help.faq2.a': { fr: 'Une CNI valide, un justificatif de domicile récent et optionnellement votre numéro NIU.', en: 'A valid ID card, a recent proof of address and optionally your NIU number.' },
  'help.faq3.q': { fr: 'Comment geler ma carte ?', en: 'How to freeze my card?' },
  'help.faq3.a': { fr: 'Allez dans l\'onglet Cartes, puis activez le switch "Geler" sur la carte concernée. Vous pouvez la dégeler à tout moment.', en: 'Go to the Cards tab, then toggle the "Freeze" switch on the relevant card. You can unfreeze it at any time.' },
  'help.faq4.q': { fr: 'Les transferts Mobile Money sont-ils gratuits ?', en: 'Are Mobile Money transfers free?' },
  'help.faq4.a': { fr: 'Les transferts entre comptes BICEC sont gratuits. Les transferts Mobile Money peuvent avoir des frais selon le montant.', en: 'Transfers between BICEC accounts are free. Mobile Money transfers may have fees depending on the amount.' },
  'help.faq5.q': { fr: 'Comment contacter le support ?', en: 'How to contact support?' },
  'help.faq5.a': { fr: 'Via le chat in-app dans Plus > Support, ou appelez le +237 233 50 00 00.', en: 'Via the in-app chat in More > Support, or call +237 233 50 00 00.' },
  'help.contact': { fr: 'Nous contacter', en: 'Contact us' },
  'help.callUs': { fr: 'Appelez-nous', en: 'Call us' },
  'help.chat': { fr: 'Chat en direct', en: 'Live chat' },
  'help.chatDesc': { fr: 'Disponible du lundi au vendredi, 8h-18h', en: 'Available Monday to Friday, 8am-6pm' },

  // More
  'more.linkedAccounts': { fr: 'Comptes liés', en: 'Linked accounts' },
  'more.lock': { fr: 'Verrouiller', en: 'Lock' },
  'more.logout': { fr: 'Déconnexion', en: 'Log out' },

  // Rejection & Support
  'rejection.title': { fr: 'Dossier refusé', en: 'Application rejected' },
  'rejection.retry': { fr: 'Réessayer', en: 'Retry' },
  'rejection.support': { fr: 'Contacter le support', en: 'Contact support' },
  'support.title': { fr: 'Support', en: 'Support' },
  'notifications.title': { fr: 'Notifications', en: 'Notifications' },

  // Common
  'common.next': { fr: 'Suivant', en: 'Next' },
  'common.back': { fr: 'Retour', en: 'Back' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel' },
  'common.confirm': { fr: 'Confirmer', en: 'Confirm' },
  'common.save': { fr: 'Enregistrer', en: 'Save' },
  'common.close': { fr: 'Fermer', en: 'Close' },
  'common.continue': { fr: 'Continuer', en: 'Continue' },
  'offline.banner': { fr: 'Hors ligne — vos données sont sauvegardées', en: 'Offline — your data is saved' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'fr', setLanguage: () => {}, t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() =>
    (localStorage.getItem('vp_lang') as Language) || 'fr'
  );

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('vp_lang', lang);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[key]?.[language] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);