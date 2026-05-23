# Scenario Demo MVP - BICEC VeriPass

## Pitch Court

VeriPass reduit la pre-ouverture de compte a un parcours KYC mobile controle par un agent. Le prototype montre une chaine complete : pieces client, OCR, liveness, soumission, controle backoffice, complement documentaire, classification et decision finale.

## Storyboard

| Etape | Ecran | Ce qu'il faut dire |
| --- | --- | --- |
| 1 | Mobile auth | Marie s'identifie et reprend ou cree son dossier KYC. |
| 2 | Upload CNI | La CNI recto/verso est capturee, hashee et envoyee au backend. |
| 3 | OCR | Les champs sont extraits automatiquement et restent corrigeables. |
| 4 | Liveness | Le selfie/liveness ajoute une preuve de presence. |
| 5 | Soumission | Le dossier passe en revue agent, sans donner acces a des operations bancaires reelles. |
| 6 | Backoffice Jean | Jean consulte la file, les documents, les champs OCR, la biometrie et l'audit. |
| 7 | Demande complement | Jean demande un document manquant ou plus lisible avec une justification. |
| 8 | Retour client | Marie fournit le document demande et resoumet le meme dossier. |
| 9 | Classification | Jean assigne le nouveau document a une ou plusieurs categories KYC. |
| 10 | Validation | Jean valide le dossier ; Marie voit le statut final. |

## Ce Qui Est Reel

- API FastAPI, PostgreSQL, Redis et Celery sous Docker.
- OCR appele depuis le backend.
- Stockage document avec hash SHA-256.
- Workflow KYC avec statuts `DRAFT`, `PENDING_AGENT_REVIEW`, `PENDING_INFO`, `APPROVED`, `REJECTED`.
- Backoffice de revue avec decisions, corrections OCR, assignation et audit.
- Monitoring Sentry conserve.

## Ce Qui Est Volontairement Hors Perimetre

- DGI reelle.
- Transactions bancaires reelles.
- Core banking.
- Decision AML production-grade.

## Questions Techniques Probables

**Pourquoi Docker ?**  
Pour rendre la demo reproductible avec API, DB, Redis, workers, mobile et backoffice dans le meme environnement.

**Pourquoi garder un humain ?**  
Parce que la banque doit pouvoir justifier la decision et gerer les cas ambigus : document flou, OCR incomplet, complement demande.

**Pourquoi OCR + correction ?**  
L'OCR accelere la saisie, mais la correction humaine garde le controle et la tracabilite.

**Pourquoi pas DGI ou banking reel ?**  
Ce serait un autre projet d'integration. Le MVP prouve le parcours KYC de pre-ouverture et la validation documentaire.

**Comment prouver la tracabilite ?**  
Les actions critiques creent des entrees audit : soumission, resoumission, decision, assignation, correction OCR et classification documentaire.
