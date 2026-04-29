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
    'ocr.processing.subtitle': { fr: 'Nous avons lu votre document. Veuillez corriger si besoin.', en: 'We read your document. Please correct if needed.' },

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
    'stepper.signature': { fr: 'Signature', en: 'Signature' },
    'stepper.review': { fr: 'Revue', en: 'Review' },
};

