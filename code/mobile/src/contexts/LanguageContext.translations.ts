import type { Language } from '../types';

export const translations: Record<string, Record<Language, string>> = {
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
    'welcome.cta.primary': { fr: 'Ouvrir mon compte', en: 'Open my account' },
    'welcome.cta.secondary': { fr: 'Me connecter', en: 'Log in' },

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

    // PIN Login
    'pinLogin.title': { fr: 'Bon retour !', en: 'Welcome back!' },
    'pinLogin.subtitle': { fr: 'Entrez votre code PIN pour accéder à votre compte', en: 'Enter your PIN to access your account' },
    'pinLogin.error': { fr: 'Code PIN incorrect', en: 'Incorrect PIN' },
    'pinLogin.remaining': { fr: 'essais restants', en: 'attempts remaining' },
    'pinLogin.blocked': { fr: 'Compte bloqué. Veuillez vous reconnecter par OTP.', en: 'Account blocked. Please reconnect via OTP.' },
    'pinLogin.forgot': { fr: 'Code PIN oublié ?', en: 'Forgot PIN?' },

    // KYC Intro & Progress
    'kyc.progress.title': { fr: 'Ouverture de compte', en: 'Account Opening' },
    'kyc.whatYouNeed.title': { fr: 'Ce dont vous avez besoin', en: 'What you need' },
    'kyc.whatYouNeed.time': { fr: 'Cela prendra environ 5-10 minutes', en: 'This will take about 5-10 minutes' },
    'kyc.whatYouNeed.id': { fr: "Pièce d'identité (CNI ou Passeport)", en: 'ID Card or Passport' },
    'kyc.whatYouNeed.cni': { fr: "Carte Nationale d'Identité", en: 'National ID Card' },
    'kyc.whatYouNeed.selfie': { fr: 'Votre plus beau sourire (Liveness)', en: 'Your best smile (Liveness)' },
    'kyc.whatYouNeed.address': { fr: 'Justificatif de domicile', en: 'Proof of address' },
    'kyc.whatYouNeed.niu': { fr: 'Numéro Identifiant Unique', en: 'Unique ID Number' },
    'kyc.whatYouNeed.ready': { fr: 'Continuer', en: 'Continue' },

    // KYC Capture UI
    'cni.recto.title': { fr: 'Recto de la CNI', en: 'ID Front Side' },
    'cni.recto.placeholder': { fr: 'Placez le recto de votre CNI ici', en: 'Place the front of your ID here' },
    'cni.recto.tip': { fr: 'Vérifiez que toutes les informations sont lisibles', en: 'Make sure all information is readable' },
    'cni.verso.title': { fr: 'Verso de la CNI', en: 'ID Back Side' },
    'cni.verso.tip': { fr: 'Alignez le verso dans le cadre', en: 'Align the back side in the frame' },
    'capture.tip.light': { fr: 'Bon éclairage requis', en: 'Good lighting required' },
    'capture.tip.steady': { fr: 'Gardez la caméra stable', en: 'Keep the camera steady' },
    'capture.tip.align': { fr: 'Alignez dans le cadre', en: 'Align in the frame' },
    'capture.open.camera': { fr: 'Ouvrir la caméra', en: 'Open Camera' },
    'capture.quality.good': { fr: 'Qualité optimale', en: 'Optimal quality' },
    'capture.quality.blurry': { fr: 'Image floue', en: 'Blurry image' },
    'capture.quality.dark': { fr: 'Trop sombre', en: 'Too dark' },
    'capture.quality.glare': { fr: 'Reflets détectés', en: 'Glares detected' },
    'capture.quality.analyzing': { fr: 'Analyse en cours...', en: 'Analyzing...' },
    'capture.manual': { fr: 'Prendre la photo', en: 'Take Photo' },
    'capture.adjust': { fr: 'Ajustez la position du document', en: 'Adjust document position' },
    'capture.camera.error': { fr: 'Erreur caméra', en: 'Camera Error' },

    // KYC OCR Review
    'ocr.review.title': { fr: 'Révision OCR', en: 'OCR Review' },
    'ocr.review.subtitle': { fr: 'Vérifiez les données extraites', en: 'Verify extracted data' },

    // KYC Liveness
    'liveness.intro.title': { fr: 'Vérification de vie', en: 'Liveness Check' },
    'liveness.intro.subtitle': { fr: 'Veuillez suivre les instructions à l\'écran', en: 'Please follow on- screen instructions' },
    'liveness.challenge.smile': { fr: 'Souriez :)', en: 'Smile :)' },

    // KYC Hydration Gate
    'kyc.hydration.title': { fr: 'Restauration de votre progression', en: 'Restoring your progress' },
    'kyc.hydration.subtitle': { fr: 'Veuillez patienter...', en: 'Please wait...' },

    // CNI Quality
    'cni.resolution': { fr: 'Résolution insuffisante', en: 'Resolution too low' },
    'cni.sharpness': { fr: 'Image floue', en: 'Image is blurry' },
    'cni.brightness': { fr: 'Luminosité incorrecte', en: 'Brightness out of range' },
    'cni.glare': { fr: 'Reflets détectés', en: 'Glare detected' },
    'cni.aspect_ratio': { fr: 'Cadrage incorrect', en: 'Wrong framing' },

    // Celebration
    'celebration.title': { fr: 'Félicitations !', en: 'Congratulations!' },
    'celebration.message': { fr: 'Votre dossier a été soumis avec succès.', en: 'Your application has been submitted successfully.' },

    // Biometric Login
    'auth.biometric.login': { fr: 'Connexion biométrique', en: 'Biometric login' },
    'auth.biometric.try': { fr: 'Essayer la biométrie', en: 'Try biometric login' },
    'auth.biometric.unsupported': { fr: 'Non disponible sur cet appareil', en: 'Not available on this device' },
    'auth.biometric.failed': { fr: 'Biométrie échouée, utilisez le PIN', en: 'Biometric failed, use PIN' },

    // Progress Stepper
    'stepper.cni': { fr: 'CNI', en: 'ID Card' },
    'stepper.ocr': { fr: 'OCR', en: 'OCR' },
    'stepper.liveness': { fr: 'Visage', en: 'Face' },
    'stepper.address': { fr: 'Adresse', en: 'Address' },
    'stepper.bill': { fr: 'Facture', en: 'Bill' },
    'stepper.niu': { fr: 'NIU', en: 'NIU' },
    'stepper.consent': { fr: 'Consent.', en: 'Consent' },

    // NIU Screen
    'niu.title': { fr: 'Numéro fiscal (NIU)', en: 'Tax ID (NIU)' },
    'niu.skip.warning': { fr: 'Vous pouvez passer cette étape, mais cela peut ralentir votre vérification.', en: 'You can skip this step, but it may slow down your verification.' },
    'niu.upload': { fr: 'Photographier mon attestation NIU', en: 'Photograph my NIU certificate' },
    'niu.manual': { fr: 'Saisir manuellement', en: 'Enter manually' },
    'niu.format.hint': { fr: 'Format : M suivi de 10 à 14 chiffres', en: 'Format: M followed by 10-14 digits' },
    'niu.skip': { fr: 'Passer cette étape', en: 'Skip this step' },
    'niu.enter': { fr: 'Entrez votre Numéro Identifiant Unique', en: 'Enter your Unique Identification Number' },
    'stepper.signature': { fr: 'Signature', en: 'Signature' },
    'stepper.review': { fr: 'Revue', en: 'Review' },

    // Navigation
    'nav.home': { fr: 'Accueil', en: 'Home' },
    'nav.cards': { fr: 'Cartes', en: 'Cards' },
    'nav.transfers': { fr: 'Virements', en: 'Transfers' },
    'nav.more': { fr: 'Plus', en: 'More' },

    // Dashboard
    'dashboard.greeting': { fr: 'Bonjour,', en: 'Hello,' },
    'dashboard.balance': { fr: 'Solde', en: 'Balance' },
    'dashboard.mainAccount': { fr: 'Compte principal', en: 'Main account' },
    'dashboard.kycRequired': { fr: 'Complétez votre vérification d\'identité pour accéder à tous les services BICEC.', en: 'Complete your identity verification to access all BICEC services.' },
    'dashboard.completeKyc': { fr: 'Continuer ma vérification', en: 'Continue my verification' },
    'dashboard.recentTransactions': { fr: 'Dernières opérations', en: 'Recent transactions' },
    'dashboard.pockets': { fr: 'Mes poches', en: 'My pockets' },
    'dashboard.ecosystem': { fr: 'Écosystème BICEC', en: 'BICEC Ecosystem' },
    'dashboard.restricted.banner': { fr: 'Complétez votre KYC pour débloquer les services', en: 'Complete your KYC to unlock services' },
    'dashboard.limited.banner': { fr: 'Ajoutez votre NIU pour l\'accès complet', en: 'Add your NIU for full access' },
    'dashboard.ecosystem.title': { fr: 'Écosystème BICEC', en: 'BICEC Ecosystem' },
    'dashboard.ecosystem.hint': { fr: 'Connectez vos applications BICEC', en: 'Connect your BICEC apps' },

    // Cards
    'cards.empty': { fr: 'Aucune carte disponible', en: 'No card available' },
    'cards.frozen': { fr: 'Carte gelée', en: 'Card frozen' },
    'cards.frozenDesc': { fr: 'La carte est temporairement bloquée', en: 'Card is temporarily blocked' },
    'cards.freeze': { fr: 'Geler', en: 'Freeze' },
    'cards.freezeDesc': { fr: 'Bloquer temporairement la carte', en: 'Temporarily block card' },
    'cards.show': { fr: 'Détails', en: 'Details' },
    'cards.hide': { fr: 'Masquer', en: 'Hide' },
    'cards.copy': { fr: 'Copier', en: 'Copy' },
    'cards.findAtm': { fr: 'Trouver un DAB', en: 'Find an ATM' },
    'cards.findAtmDesc': { fr: 'Localiser les distributeurs à proximité', en: 'Locate nearby ATMs' },

    // Transfers
    'transfer.send.title': { fr: 'Envoyer', en: 'Send' },
    'transfer.send.desc': { fr: 'Virement bancaire ou mobile', en: 'Bank or mobile transfer' },
    'transfer.send.chooseType': { fr: 'Choisissez le type de transfert', en: 'Choose transfer type' },
    'transfer.send.bicec': { fr: 'Virement BICEC', en: 'BICEC Transfer' },
    'transfer.send.bicecDesc': { fr: 'Vers un compte BICEC', en: 'To a BICEC account' },
    'transfer.send.mobile': { fr: 'Mobile Money', en: 'Mobile Money' },
    'transfer.send.mobileDesc': { fr: 'MTN MoMo, Orange Money', en: 'MTN MoMo, Orange Money' },
    'transfer.send.phoneNumber': { fr: 'Numéro de téléphone', en: 'Phone number' },
    'transfer.send.amount': { fr: 'Montant', en: 'Amount' },
    'transfer.send.motif': { fr: 'Motif', en: 'Reason' },
    'transfer.send.motifPlaceholder': { fr: 'Ex: Paiement loyer', en: 'Ex: Rent payment' },
    'transfer.send.summary': { fr: 'Récapitulatif', en: 'Summary' },
    'transfer.send.to': { fr: 'Destinataire', en: 'Recipient' },
    'transfer.send.fees': { fr: 'Frais', en: 'Fees' },
    'transfer.send.enterPin': { fr: 'Entrez votre PIN pour confirmer', en: 'Enter your PIN to confirm' },
    'transfer.success.title': { fr: 'Transfert réussi !', en: 'Transfer successful!' },
    'transfer.success.back': { fr: 'Retour au tableau de bord', en: 'Back to dashboard' },
    'transfer.recurring': { fr: 'Virements récurrents', en: 'Recurring transfers' },
    'transfer.recurringDesc': { fr: 'Planifiez des virements automatiques', en: 'Schedule automatic transfers' },
    'transfer.iso.iban': { fr: 'IBAN', en: 'IBAN' },
    'transfer.iso.name': { fr: 'Nom du bénéficiaire', en: 'Beneficiary name' },
    'transfer.iso.bic': { fr: 'BIC / SWIFT', en: 'BIC / SWIFT' },
    'transfer.iso.invalidIban': { fr: 'IBAN invalide', en: 'Invalid IBAN' },
    'transfer.iso.scheme': { fr: 'Schéma', en: 'Scheme' },
    'transfer.iso.endToEnd': { fr: 'End-to-End ID', en: 'End-to-End ID' },
    'transfer.iso.msgId': { fr: 'Message ID', en: 'Message ID' },
    'transfer.iso.download': { fr: 'Télécharger le reçu ISO 20022', en: 'Download ISO 20022 receipt' },

    // Receive
    'receive.title': { fr: 'Recevoir', en: 'Receive' },
    'receive.desc': { fr: 'Vos coordonnées bancaires', en: 'Your bank details' },
    'receive.holder': { fr: 'Titulaire', en: 'Holder' },
    'receive.bankCode': { fr: 'Code banque', en: 'Bank code' },
    'receive.branchCode': { fr: 'Code agence', en: 'Branch code' },
    'receive.accountNumber': { fr: 'Numéro de compte', en: 'Account number' },
    'receive.key': { fr: 'Clé RIB', en: 'RIB Key' },
    'receive.scanQr': { fr: 'Scannez pour recevoir', en: 'Scan to receive' },
    'receive.copyIban': { fr: 'Copier l\'IBAN', en: 'Copy IBAN' },

    // Transactions
    'transactions.title': { fr: 'Transactions', en: 'Transactions' },
    'transactions.empty': { fr: 'Aucune opération pour le moment', en: 'No transaction yet' },
    'transactions.filter.all': { fr: 'Tout', en: 'All' },
    'transactions.filter.in': { fr: 'Entrées', en: 'Income' },
    'transactions.filter.out': { fr: 'Sorties', en: 'Expenses' },

    // Savings
    'savings.title': { fr: 'Épargne', en: 'Savings' },
    'savings.total': { fr: 'Total épargné', en: 'Total saved' },
    'savings.pockets': { fr: 'Mes poches', en: 'My pockets' },
    'savings.create': { fr: 'Créer', en: 'Create' },
    'savings.newPocket': { fr: 'Nouvelle poche', en: 'New pocket' },
    'savings.pocketName': { fr: 'Nom de la poche', en: 'Pocket name' },
    'savings.goal': { fr: 'Objectif', en: 'Goal' },
    'savings.initialAmount': { fr: 'Montant initial', en: 'Initial amount' },
    'savings.createBtn': { fr: 'Créer la poche', en: 'Create pocket' },
    'savings.empty': { fr: 'Aucune poche d\'épargne', en: 'No savings pocket' },
    'savings.tip': { fr: 'Conseil : mettez de côté régulièrement même de petites sommes.', en: 'Tip: set aside regularly even small amounts.' },

    // Settings
    'settings.title': { fr: 'Paramètres', en: 'Settings' },
    'settings.language': { fr: 'Langue', en: 'Language' },
    'settings.preferences': { fr: 'Préférences', en: 'Preferences' },
    'settings.biometric': { fr: 'Biométrie', en: 'Biometrics' },
    'settings.notifications': { fr: 'Notifications push', en: 'Push notifications' },
    'settings.darkMode': { fr: 'Mode sombre', en: 'Dark mode' },
    'settings.security': { fr: 'Sécurité', en: 'Security' },
    'settings.changePin': { fr: 'Changer le PIN', en: 'Change PIN' },
    'settings.privacy': { fr: 'Confidentialité', en: 'Privacy' },
    'settings.dev.title': { fr: 'Développement', en: 'Development' },
    'settings.dev.fullAccess': { fr: 'Forcer Full Access', en: 'Force Full Access' },

    // Notifications
    'notifications.title': { fr: 'Notifications', en: 'Notifications' },
    'notifications.empty': { fr: 'Aucune notification', en: 'No notification' },

    // Help
    'help.title': { fr: 'Aide', en: 'Help' },
    'help.faq': { fr: 'Questions fréquentes', en: 'FAQ' },
    'help.chat': { fr: 'Chat support', en: 'Chat support' },
    'help.call': { fr: 'Appeler', en: 'Call' },
    'help.language': { fr: 'fr', en: 'fr' },

    // Support
    'support.title': { fr: 'Support', en: 'Support' },
    'support.empty': { fr: 'Démarrez une conversation avec notre équipe.', en: 'Start a conversation with our team.' },
    'support.placeholder': { fr: 'Tapez votre message...', en: 'Type your message...' },

    // More
    'more.title': { fr: 'Plus', en: 'More' },
    'more.services': { fr: 'Services', en: 'Services' },
    'more.settings': { fr: 'Compte', en: 'Account' },
    'more.logout': { fr: 'Se déconnecter', en: 'Log out' },
    'more.confirmLogout': { fr: 'Se déconnecter ?', en: 'Log out?' },
    'more.confirm': { fr: 'Confirmer', en: 'Confirm' },

    // Common
    'common.continue': { fr: 'Continuer', en: 'Continue' },
    'common.confirm': { fr: 'Confirmer', en: 'Confirm' },
    'common.cancel': { fr: 'Annuler', en: 'Cancel' },
    'common.seeAll': { fr: 'Voir tout', en: 'See all' },

    // Review Screen
    'review.title': { fr: 'Vérification du dossier', en: 'Review Application' },
    'review.identity': { fr: 'Identité', en: 'Identity' },
    'review.address': { fr: 'Adresse', en: 'Address' },
    'review.niu.yes': { fr: '✓ NIU fourni', en: '✓ NIU provided' },
    'review.niu.no': { fr: 'Optionnel · non fourni', en: 'Optional · not provided' },
    'review.consent': { fr: 'Consentements', en: 'Consents' },
    'review.consent.cgu': { fr: '✓ CGU acceptées', en: '✓ Terms accepted' },
    'review.submit': { fr: 'Soumettre le dossier KYC', en: 'Submit KYC Application' },

    // Consent Screen
    'consent.title': { fr: 'Consentements', en: 'Consents' },
    'consent.cgu': { fr: 'Conditions Générales d\'Utilisation', en: 'Terms of Service' },
    'consent.privacy': { fr: 'Politique de confidentialité', en: 'Privacy Policy' },
    'consent.data': { fr: 'Traitement des données personnelles', en: 'Personal Data Processing' },
    'consent.readDoc': { fr: 'Lire le document', en: 'Read document' },
    'consent.submit': { fr: 'J\'accepte et je continue', en: 'I accept and continue' },

    // Signature Screen
    'signature.title': { fr: 'Signature électronique', en: 'Electronic Signature' },
    'signature.instruction': { fr: 'Signez pour confirmer votre identité', en: 'Sign to confirm your identity' },

    // CNI Capture Quality
    'capture.quality.cni_fail': { fr: 'Qualité insuffisante', en: 'Insufficient quality' },

    // Rejection Screen
    'rejection.title': { fr: 'Dossier refusé', en: 'Application Rejected' },
    'rejection.heading': { fr: 'Votre dossier a été refusé', en: 'Your application has been rejected' },
    'rejection.subtitle': { fr: 'Notre équipe de validation a examiné votre dossier et a pris la décision suivante.', en: 'Our validation team has reviewed your application and made the following decision.' },
    'rejection.decision': { fr: 'Décision', en: 'Decision' },
    'rejection.decidedAt': { fr: 'Le', en: 'On' },
    'rejection.noReason': { fr: 'Aucun motif spécifié.', en: 'No reason specified.' },
    'rejection.retry': { fr: 'Recommencer la procédure KYC', en: 'Restart KYC procedure' },
    'rejection.contactSupport': { fr: 'Contacter le support', en: 'Contact support' },
    'rejection.backDashboard': { fr: 'Retour au tableau de bord', en: 'Back to dashboard' },
    'rejection.help': { fr: 'Si vous pensez qu\'il s\'agit d\'une erreur, contactez notre support ou rendez-vous en agence BICEC avec vos documents originaux.', en: 'If you believe this is an error, contact our support or visit a BICEC branch with your original documents.' },

    // Info Requested Screen
    'infoRequested.title': { fr: 'Informations requises', en: 'Information Required' },
    'infoRequested.heading': { fr: 'Informations complémentaires requises', en: 'Additional information required' },
    'infoRequested.subtitle': { fr: 'Notre équipe de validation a besoin d\'informations supplémentaires pour traiter votre dossier.', en: 'Our validation team needs additional information to process your application.' },
    'infoRequested.agentRequest': { fr: 'Demande de l\'agent', en: 'Agent request' },
    'infoRequested.requestedAt': { fr: 'Demandé le', en: 'Requested on' },
    'infoRequested.noReason': { fr: 'Informations complémentaires requises.', en: 'Additional information required.' },
    'infoRequested.resubmit': { fr: 'Fournir les informations', en: 'Provide information' },
    'infoRequested.resubmitting': { fr: 'Préparation...', en: 'Preparing...' },
    'infoRequested.contactSupport': { fr: 'Contacter le support', en: 'Contact support' },
    'infoRequested.backDashboard': { fr: 'Retour au tableau de bord', en: 'Back to dashboard' },
    'infoRequested.help': { fr: 'Vous pouvez fournir les documents manquants directement depuis l\'application ou vous rendre en agence BICEC.', en: 'You can provide the missing documents directly from the app or visit a BICEC branch.' },

    // Liveness Intro
    'liveness.intro.start': { fr: 'Commencer la vérification', en: 'Start verification' },
    'liveness.intro.step1': { fr: 'Souriez naturellement', en: 'Smile naturally' },
    'liveness.intro.step2': { fr: 'Clignez des yeux', en: 'Blink your eyes' },
    'liveness.intro.step3': { fr: 'Tournez la tête légèrement', en: 'Turn your head slightly' },
    'liveness.intro.privacy': { fr: 'Votre selfie est traité de manière sécurisée et ne sera pas conservé.', en: 'Your selfie is processed securely and will not be stored.' },

    // OCR Processing
    'ocr.processing.title': { fr: 'Analyse de votre document', en: 'Analyzing your document' },
    'ocr.processing.subtitle': { fr: 'Extraction automatique des informations en cours...', en: 'Automatic information extraction in progress...' },

    // Progress Timeline
    'kyc.progress.heading': { fr: 'Votre parcours', en: 'Your journey' },
    'kyc.progress.subtitle': { fr: 'Voici les étapes à compléter pour ouvrir votre compte.', en: 'Here are the steps to complete to open your account.' },
    'kyc.progress.duration': { fr: '~10 minutes', en: '~10 minutes' },
    'kyc.progress.start': { fr: 'Commencer', en: 'Start' },

    // Auth Biometric
    'cni.intro.title': { fr: "Vérification d'identité", en: 'Identity Verification' },
    'cni.intro.why': { fr: "Nous devons vérifier votre identité pour sécuriser votre compte et respecter la réglementation bancaire.", en: 'We need to verify your identity to secure your account and comply with banking regulations.' },
    'cni.intro.secure': { fr: 'Vos données sont cryptées et sécurisées', en: 'Your data is encrypted and secure' },
    'auth.biometric.secure': { fr: 'Données biométriques stockées localement', en: 'Biometric data stored locally' },
    'ocr.loading.text': { fr: 'Analyse de votre document en cours...', en: 'Analyzing your document...' },
};

