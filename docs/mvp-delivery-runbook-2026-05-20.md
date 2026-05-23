# MVP Delivery Runbook - BICEC VeriPass

Date: 2026-05-20

## Objectif

Livrer une demonstration KYC souveraine, simple a presenter, centree sur le parcours :

`mobile -> upload CNI -> OCR -> liveness -> soumission -> backoffice validation / demande fichier -> client renvoie -> backoffice assigne le document -> validation finale`.

## Hors Perimetre Assume

- Pas d'integration DGI reelle.
- Pas de banking transactionnel reel.
- Sentry reste active comme monitoring applicatif.
- Le MVP ne se presente pas comme un core banking complet.

## Prerequis Demo

- Docker Desktop demarre.
- Images Docker et dependances deja presentes en cache.
- Ne pas lancer le profile `online-init`.
- Utiliser Bun pour mobile/backoffice, pas npm ni yarn.

## Demarrage

Depuis la racine du repo :

```powershell
docker compose -f code/docker-compose.yml up -d api pwa backoffice postgres redis celery_ocr celery_notifications celery_beat mailpit nginx
docker compose -f code/docker-compose.yml ps
```

URLs utiles :

- Mobile PWA : `http://localhost:3000/mobile/`
- Backoffice : `http://localhost:3001/`
- API health : `http://localhost:8001/api/health`
- Mailpit : `http://localhost:8025/`
- Flower : `http://localhost:5555/`

Comptes backoffice seedes :

- `jean@bicec.cm` / `password123`
- `thomas@bicec.cm` / `password123`
- `sylvie@bicec.cm` / `password123`
- `admin@bicec.cm` / `password123`

## Smoke Test

```powershell
.\code\scripts\smoke_mvp_docker.ps1
```

Le smoke test verifie :

- services Docker en cours d'execution ;
- API, PostgreSQL et Redis OK ;
- Alembic sur la migration head ;
- mobile et backoffice servis en HTTP 200.

## Validations Avant Presentation

```powershell
cd code/mobile
bun run test
bun run build
```

```powershell
cd code/backoffice
bunx tsc --noEmit
```

Le build backoffice doit etre valide via Docker si le host Windows bloque esbuild :

```powershell
docker compose -f code/docker-compose.yml build backoffice
```

## Parcours Manuel A Montrer

1. Ouvrir le mobile et demarrer le KYC client.
2. Uploader CNI recto/verso.
3. Montrer OCR et correction manuelle si necessaire.
4. Passer le liveness.
5. Ajouter facture, adresse, NIU/choix declaratif, consentement et signature.
6. Soumettre le dossier.
7. Ouvrir le backoffice avec Jean.
8. Ouvrir le dossier, consulter pieces, OCR, biometrie et timeline audit.
9. Demander un complement documentaire.
10. Retour mobile : fournir les informations demandees et resoumettre.
11. Backoffice : classifier le nouveau document dans la categorie attendue.
12. Valider le dossier.
13. Retour mobile : afficher le statut final.

## Message De Soutenance

BICEC VeriPass est un MVP souverain de pre-ouverture de compte par KYC assiste. La valeur demontree est le parcours client, l'OCR, la validation humaine, la gestion des complements, la tracabilite, et l'execution Docker controlee sans integration DGI ou core banking transactionnel.
