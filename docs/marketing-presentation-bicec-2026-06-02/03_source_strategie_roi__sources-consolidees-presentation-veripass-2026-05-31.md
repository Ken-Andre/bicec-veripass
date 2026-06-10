# VeriPass BICEC - Sources consolidees presentation

Date: 2026-05-31  
Livrable: `_bmad-output/veripass-rail-kyc-souverain-bicec-v3-2026-05-31.pptx`

## 1. References utilisateur

- Deck precedent a ameliorer: `C:\Users\yoann\Downloads\VeriPass - Rail KYC Souverain BICEC.pptx`
- Benchmark DigitalKYC: `C:\Users\yoann\Downloads\digitalkycmodules-230516103830-da936dc4.pdf`
- Analyse profonde du PDF: `_bmad-output/digitalkyc-benchmark-adaptation-veripass-2026-05-31.md`
- Source narrative consolidee: `_bmad-output/veripass-strategic-war-room-2026-05-31.md`

## 2. Ce que le benchmark DigitalKYC nous apprend

DigitalKYC ne vend pas seulement des ecrans. Il vend une infrastructure de confiance:

- front office: parcours web/mobile, omni-canal, support client;
- factory: collecte, verification, scoring, workflow, portail conformite;
- lifecycle: dossier central KYC/AML, monitoring, remediation, reporting.

Adaptation VeriPass: ne pas copier leurs promesses globales. Traduire leur logique dans la realite BICEC: CNI Cameroun, mobile PWA, OCR review, liveness, backoffice, AML bloquant, audit, pilotage, puis pilote court avec mesures BICEC.

## 3. Sources marche et concurrence

- World Bank Global Findex 2025: https://www.worldbank.org/en/news/press-release/2025/07/16/mobile-phone-technology-powers-saving-surge-in-developing-economies
- GSMA Mobile Money 2026 press release: https://www.gsma.com/newsroom/press-release/mobile-money-accounted-for-2-trillion-in-transactions-in-2025-doubling-since-2021-as-active-accounts-continue-to-grow/
- GSMA Mobile Money 2025 report: https://www.gsma.com/sotir/wp-content/uploads/2025/04/The-State-of-the-Industry-Report-2025_English.pdf
- BGFI Cameroun online onboarding: https://leclientcm.bgfi.com/en/
- MyBGFIBANK CM Google Play: https://play.google.com/store/apps/details?id=com.bfi.digital.cameroun
- MyBGFIBANK CM App Store Cameroun: https://apps.apple.com/cm/app/mybgfibank-cm/id6449455570
- Ecobank Xpress Account Cameroun: https://ecobank.com/cm/personal-banking/ways-to-bank/mobile/mobile-banking-via-app/xpress-account
- Orange Money Cameroun account management: https://orangemoney.orange.cm/fr/gestion-compte.html
- UBA Cameroon digital banking: https://www.ubacameroon.com/home/personal/banque-digitale/ubamobileapp/
- BICEC devenir client: https://www.bicec.com/devenir-client/
- COBAC 2024 annual report: https://www.beac.int/wp-content/uploads/2016/10/Rapport-annuel-de-la-COBAC-2024-PDF-14.8-Mo_compressed-1.pdf

Les acteurs sans preuve accessible et defendable n'ont pas ete gardes dans le deck.

## 4. Preuves internes VeriPass utilisees

- `docs/documentation-authority.md`
- `docs/project-overview.md`
- `docs/architecture.md`
- `docs/test-evidence/latest/kyc-happy-path/README.md`
- `docs/test-evidence/latest/kyc-compliance-demo/README.md`
- `docs/test-evidence/latest/mobile/.last-run.json`
- `docs/test-evidence/latest/backoffice/.last-run.json`
- `docs/test-evidence/latest/mobile/screens/live-client-after-login.png`
- `docs/test-evidence/latest/kyc-compliance-demo/screens/11-mobile-document-scope-cni-only-disabled-options.png`
- `docs/test-evidence/latest/kyc-compliance-demo/screens/07-jean-queue-biometric-priority-flag.png`
- `docs/test-evidence/latest/kyc-compliance-demo/screens/08-jean-dossier-biometric-risk-and-aml-alert.png`
- `docs/test-evidence/latest/kyc-compliance-demo/screens/10-jean-approval-blocked-by-open-aml-alert.png`
- `docs/test-evidence/latest/backoffice/screens/role-sylvie-command-center.png`
- `docs/test-evidence/latest/backoffice/screens/cobac-audit-report-ui-final.png`

## 5. Limites volontairement exclues du pitch

Le deck ne promet pas:

- effectif BICEC ou chiffres internes que BICEC connait mieux que nous;
- ROI invente;
- deploiement coeur bancaire en production;
- couverture documents monde entier;
- KYB complet;
- prestataires externes nommes sans achat/procurement;
- decision automatique sans controle humain;
- extension au-dela de la CNI Cameroun comme fait actuel.

Position de vente retenue: BICEC ne doit pas acheter une dependance. BICEC doit mesurer son propre rail KYC local avant que le marche ne l'oblige a louer cette porte d'entree ailleurs.
