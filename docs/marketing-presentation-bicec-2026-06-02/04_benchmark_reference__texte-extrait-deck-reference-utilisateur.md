# Reference PPTX Text Extract

File: C:\Users\yoann\Downloads\VeriPass - Rail KYC Souverain BICEC.pptx
Slides: 17

## Slide 1
BICEC VERIPASS LE RAIL KYC SOUVERAIN De la capture client a la decision bancaire tracable. Transformer l'ouverture de compte en preuve bancaire. Proposition de pilote KYC digital | Juin 2026

## Slide 2
SOMMAIRE 4 CHAPITRES. 1 OPPORTUNITE. 01 LE CONTEXTE Le monde bascule vers le mobile. La bataille pour l'entree client digitale est deja engagee au Cameroun. 02 LA SOLUTION VeriPass : le rail KYC souverain qui reduit la friction et structure les preuves. 03 LA PREUVE Securite, conformite AML/COBAC, audit tracable et pilotage en temps reel. 04 L'OPPORTUNITE Un pilote mesurable, une decision eclairee. N'achetez pas un logiciel. Achetez l'avance.

## Slide 3
01 CHAPITRE 01 LE CONTEXTE Le monde bascule vers le mobile. La bataille pour l'entree client digitale est deja engagee au Cameroun. Et BICEC a tout pour la gagner.

## Slide 4
LE CONTEXTE Le KYC est le premier metre de la relation bancaire 40% des adultes epargent dans les economies en developpement en 2024, +10 pts vs 2021 Source : World Bank Global Findex 2025 2 000B+ USD transites via mobile money en 2025, 2,3 milliards de comptes enregistres Source : GSMA Mobile Money 2026 Le mobile n'est plus un canal secondaire. C'est une infrastructure d'acquisition cliente. LA CONCURRENCE DIGITALE AU CAMEROUN Neero / Ecobank Ouverture Xpress en minutes Orange Money Onboarding + video agent UBA M2U Wallet Portefeuille GIMAC BGFIBank Onboarding web + app BICEC a deja la credibilite bancaire, le reseau et les produits digitaux. VeriPass lui donne la porte d'entree digitale qui manque pour rivaliser avec les parcours modernes. 04

## Slide 5
LE CONTEXTE Friction client, dossiers disperses, decisions opaques AVANT ■ Pieces deposees physiquement en agence ■ Dossiers incomplets au premier passage ■ Ressaisie manuelle par les agents ■ Relances client repetees ■ Decisions difficiles a reconstituer ■ Delai : 48h a 14 jours Le parcours reste fortement physique, alors que le client attend vitesse et tracabilite. APRES VERIPASS ■ Captures guidees depuis le mobile ■ OCR + controles de completude auto ■ File back-office structuree ■ Blocage conformite integre (AML) ■ Journal d'audit exportable ■ Dossier pre-qualifie avant agence Le digital ne remplace pas l'agence. Il la prepare. 05

## Slide 6
02 CHAPITRE 02 LA SOLUTION VeriPass ne remplace pas la banque ni ses agents. Il reduit la friction client, structure les preuves KYC et donne aux equipes BICEC une chaine de validation tracable, sur site, pilotable et controlable.

## Slide 7
LA SOLUTION Chaque role recoit exactement ce qu'il doit controler FLOW COMPLET Client Mobile (PWA) → API KYC (FastAPI) → OCR + Biometrie → Jean (Validation) → Thomas (Conformite) → Sylvie (Pilotage/Audit) → Decision MARIE Cliente • PWA Mobile • Capture CNI • Liveness selfie • Consentement • Signature • Reprise session JEAN Agent KYC • File de dossiers • Inspection HR • OCR review • Biometrie flag • Approve/Reject • Audit trail THOMAS Conformite AML • Screening PEP • Alertes sanctions • Faux positifs • Deduplication • Blocage approb. • Justification SYLVIE Manager • Dashboard R/Y/G • SLA monitoring • Charge agents • Funnel analytics • Export audit • Escalade auto STACK 100% On-Premise • FastAPI • PostgreSQL • Redis + Celery • PaddleOCR/GLM • DeepFace • Docker Compose 07

## Slide 8
LA SOLUTION Parcours client : de la capture a la soumission < 15 MINUTES TARGET 1 AUTHENTIFICATION OTP SMS/Email + PIN securise 2 CAPTURE CNI Recto/verso avec guidage visuel et auto-check 3 OCR + REVUE Confirmation ou correction des champs 4 LIVENESS Selfie video, anti-spoofing, 3-strikes lockout 5 SOUMISSION Consentement + signature, reponse < 2h POINTS CLES DU PARCOURS Resilience reseau : reprise de session apres coupure 3G/delestage grace au cache local chiffre Capture intelligente : guidage visuel, detection de qualite (blur, glare), auto-framing OCR hybride : PaddleOCR primaire (< 2s) + GLM-OCR fallback pour les cas complexes Consentement explicite : 3 checkboxes distinctes (CGU, Privacy, Data Processing) Scope MVP maîtrise : CNI Cameroun uniquement, passeport et permis volontairement desactives MVP = CNI CAMEROUN 08

## Slide 9
LA SOLUTION Travail agent augmente : Jean valide, ne saisit plus LE POSTE DE JEAN - AGENT KYC 1. File de dossiers priorises Jean se connecte et voit sa queue avec scoring de priorite 2. Inspection haute resolution Comparaison side-by-side : CNI originale vs donnees OCR 3. Biometrie avec override Score de matching + flag de risque, justification obligatoire 4. Decision structuree Approuver / Rejeter (motif) / Demander info supplementaire 5. Audit automatique Chaque action = piste (qui, quoi, quand, IP) SLA CIBLES 90% validations sous 2h 98% validations sous 4h Le role de Jean devient plus qualitatif. Il ne saisit plus des donnees. Il valide des preuves, prend des decisions eclairees, et est protege par un audit complet. ACTIONS POSSIBLES Approuver Rejeter (motif) Demander info 09

## Slide 10
03 CHAPITRE 03 LA PREUVE La vitesse n'a pas le droit de contourner le risque. VeriPass bloque les approbations risquees et garde les preuves. Chaque action devient une preuve.

## Slide 11
LA PREUVE Controle conformite : l'alerte AML bloque l'approbation PRINCIPE : Aucune approbation automatique sans validation humaine | Conforme COBAC R-2023/01 LE ROLE DE THOMAS Screening PEP/Sanctions Side-by-side : profil client vs entree liste sanctions Gestion des alertes Effacer faux positif (justification obligatoire) ou confirmer match Blocage integre Meme si Jean veut approuver, une alerte AML ouverte BLOQUE la decision Override justifie Quand un risque existe, l'agent doit justifier explicitement CAPACITES AML Listes ONU, UE, OFAC integrees PEP interne BICEC maintenable Deduplication NIU (conflits d'identite) Fuzzy matching pg_trgm Scoring de similarite avec seuils Sync hebdomadaire automatique La conformite n'est pas un frein. C'est un garde-fou qui protege la croissance. 11

## Slide 12
LA PREUVE Audit COBAC-ready : chaque action est une preuve 23 actions tracees (demo) 6 acteurs distincts 9 decisions controlees 10 ans conservation COBAC COBAC-ready CAPACITES D'AUDIT JOURNAL IMMUABLE SHA-256, append-only, IP tracking. Aucune modification possible. EXPORT COBAC Pack conformite PDF + JSON + Images en un clic. CHIFFREMENT FERNET Chiffrement applicatif + Blind Indexing pour la recherche. LOI 2024-017 Consentement, minimisation, souverainete des donnees. Traçabilite complete : qui a vu quoi, qui a decide quoi, a quel moment, depuis quelle IP. 12

## Slide 13
LA PREUVE Pilotage manager : Sylvie voit tout, en temps reel COMMAND CENTER - DASHBOARD R/Y/G RED - ACTION Dossiers > 2h SLA, fraud alerts YELLOW - WATCH Drop-off rate, OCR accuracy GREEN - OK Daily onboardings, system health METRIQUES EN TEMPS REEL ■ Dossiers en file et temps d'attente moyen ■ Taux de completion du parcours client ■ Qualite OCR et taux de liveness ■ Alertes AML actives et resolution time ■ Charge par agent et distribution ■ Vue funnel : points de friction identifies CAPACITES MANAGER SLA Monitoring : escalation auto des dossiers > 2h Load Balancing : distribution intelligente par agent Export Audit : rapports de conformite en un clic Funnel Analytics : identification des drop-offs Alertes : notifications temps reel Rapports : analytics operationnels et metier 13

## Slide 14
04 CHAPITRE 04 L'OPPORTUNITE Un pilote controle, mesurable, a faible cout. 20 a 50 dossiers. 2 a 4 semaines. A la fin, la BICEC aura les donnees pour decider d'industrialiser, d'acheter, d'hybrider ou d'arreter.

## Slide 15
[no extracted text]

## Slide 16
L'OPPORTUNITE Un pilote pour mesurer, pas un deploiement pour risquer PERIMETRE PILOTE 20-50 dossiers de test controles 2-4 semaines de pilote SORTIE PILOTE ■ Rapport KPI complet ■ Analyse des risques ■ Budget industrialisation ■ Decision eclairee SPONSORS RECHERCHES ■ Banque de Detail (metier) ■ Conformite (risque) ■ DSI / Org. Qualite SI (tech) KPIs A MESURER Delais ■ Prospect -> dossier soumis ■ Dossier soumis -> decision Qualite ■ Taux dossier complet 1er passage ■ Qualite OCR CNI Efficiency ■ Temps agent par dossier ■ Taux de retours conformite Conversion ■ Taux d'abandon ■ Taux liveness a reprendre Modele ROI Le MVP permet de mesurer les variables reelles pour construire un business case fonde sur des donnees BICEC, pas sur des hypotheses. 15

## Slide 17
LA DECISION N'achetez pas un logiciel. Achetez l'avance. VeriPass n'est pas une promesse abstraite : c'est une option deja construite pour tester, apprendre et prendre position. Si BICEC attend que le marche soit evident, l'avance aura deja ete prise par quelqu'un d'autre. Projet de stage VeriPass | BICEC 2026 Rail KYC souverain | MVP demonstrable | Pilote pret
