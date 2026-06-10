# Executive summary and abstract - VeriPass

This document is insertion-ready material for the final internship report. It
addresses issue #173 and supports the final report work tracked in issue #165.

## Abstract

BICEC VeriPass is a full-stack prototype for regulated digital KYC pre-opening
in a banking context. The project addresses a practical problem: collecting,
checking and reviewing client onboarding evidence is slow when the process
depends on disconnected forms, manual document handling and weak traceability.
The proposed solution combines a mobile Progressive Web App for the client
journey, a FastAPI backend for KYC state and evidence management, asynchronous
OCR/biometric processing, and a back-office interface for agent review,
compliance supervision and audit.

The delivered MVP follows a controlled path. A client, represented by Marie,
authenticates, captures CNI documents, reviews extracted OCR fields, completes
selfie/liveness checks, address information, NIU declaration and final consent.
The dossier is then submitted to back-office review. Agents such as Jean can
inspect documents, OCR fields, biometric evidence and audit history before
making a decision or requesting additional information. Compliance personas such
as Thomas and Sylvie can inspect AML/CFT evidence, operational indicators and
audit exports.

The main contribution of the internship is not a single screen, but the
integration of product, architecture and delivery evidence into one demonstrable
workflow. The system establishes a clear separation between what the MVP proves
and what remains outside its scope. It proves a sovereign, auditable KYC
pre-opening workflow with human decision control. It does not claim direct
integration with DGI, core banking or production AML providers. Those systems
are treated as future integration boundaries that require contracts, security
review and pilot governance.

The implementation produced reusable project assets: architecture documentation,
state-machine models, mobile and back-office interfaces, API modules, evidence
screenshots, demo scripts, planning exports and GitHub issue traceability. The
remaining work before production is concentrated around hardening: real external
integrations, performance measurements on target hardware, deployment security,
final test coverage, monitoring and pilot data collection. As a result, VeriPass
can be presented as a credible MVP for decision-makers and as a technical base
for a controlled pilot.

## Resume executif

VeriPass est un prototype de pre-ouverture KYC numerique concu pour un contexte
bancaire regule. Son objectif est de reduire la friction entre le premier
contact client et la revue KYC, tout en conservant un controle humain et une
trace d'audit exploitable. Le projet repond a un besoin concret: eviter que les
equipes perdent du temps a collecter, relire et classer manuellement des pieces
client, sans pour autant automatiser aveuglement une decision bancaire sensible.

Le MVP met en scene un parcours complet. Marie, la cliente, demarre ou reprend
son dossier depuis une PWA mobile. Elle capture sa CNI, verifie les champs OCR,
complete les etapes de presence/liveness, adresse, NIU et consentement. Le
dossier passe ensuite en revue back-office. Jean, l'agent KYC, consulte une file
priorisee, ouvre le dossier, controle les documents, les extractions OCR, les
preuves biometriques et l'historique d'audit. Si le dossier est incomplet, il
peut demander un complement sans perdre la trace du parcours. Thomas et Sylvie
apportent la couche de supervision: alertes AML/CFT, indicateurs, audit et
exports.

La valeur principale pour BICEC est double. D'abord, le prototype rend le
parcours client plus fluide: la collecte se fait sur mobile, les informations
sont guidees, et les reprises de dossier deviennent possibles. Ensuite, il
renforce la gouvernance: chaque etape importante peut etre reliee a une preuve,
un statut, une action agent ou une decision. Cette approche est plus defendable
qu'une simple demonstration d'OCR, car elle montre comment l'automatisation
s'insere dans une chaine de responsabilite bancaire.

Le projet clarifie aussi les limites. VeriPass ne remplace pas le core banking,
ne cree pas un compte de production et ne pretend pas interroger directement les
services externes sans contrat. Le systeme doit plutot etre vu comme une couche
de pre-ouverture et d'eligibilite, capable de preparer un dossier propre,
documente et verifiable pour les systemes aval. Cette frontiere est importante
pour la soutenance: elle evite de presenter un prototype comme une solution
production et montre une comprehension realiste du contexte bancaire.

Sur le plan technique, le travail couvre l'architecture, le backend FastAPI, les
interfaces React/Vite, le workflow KYC, les traitements asynchrones, les
preuves de tests, la documentation et la planification projet. Les issues GitHub
ont ete repertoriees et reliees a l'historique de commits pour reconstituer une
chronologie credible des jalons atteints. Les issues restantes sont classees
par priorite afin de distinguer ce qui doit etre finalise avant la soutenance,
ce qui doit etre explique comme limite, et ce qui releve d'un futur pilote.

La suite logique est un sprint de consolidation. A court terme, il faut securiser
la demonstration, figer les jeux de donnees, verifier les parcours critiques et
terminer les sections finales du rapport. A moyen terme, il faudra renforcer la
couverture de tests, mesurer les performances sur materiel cible, durcir le
deploiement, finaliser la supervision et preparer les integrations reelles avec
les systemes BICEC. Cette trajectoire permet de passer d'un MVP convaincant a un
pilote controle, avec des preuves techniques et metier exploitables.

## Integration notes

- Use the English abstract in the report abstract section.
- Use the French executive summary before the technical chapters or as a
  management-facing opening.
- Keep the wording "MVP", "pilot foundation" and "pre-opening" to avoid
  overclaiming production readiness.
- Link the claims to:
  - `docs/demo-script.md`
  - `docs/planning/github-open-issues-inventory.md`
  - `docs/planning/remaining-issues-action-plan.md`
  - `docs/test-evidence/latest/kyc-compliance-demo/README.md`
