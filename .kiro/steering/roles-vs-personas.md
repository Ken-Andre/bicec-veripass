---
inclusion: always
---

# Rôles Fonctionnels vs Personas de Démonstration

## Règle fondamentale

Les valeurs `JEAN`, `THOMAS`, `SYLVIE`, `ADMIN_IT` dans `AgentRole` sont des
**identifiants de rôle fonctionnel**, pas des prénoms de personnes.

Ce choix est documenté dans l'architecture (§ADR-009, §7.3 Data Dictionary).

## Correspondance rôle ↔ fonction métier

| Valeur enum  | Fonction métier réelle          | Accès back-office                        |
|--------------|----------------------------------|------------------------------------------|
| `JEAN`       | Agent KYC Validateur             | Queue dossiers, approve/reject/info      |
| `THOMAS`     | Superviseur AML/CFT + Admin      | Screening PEP/Sanctions, batch Amplitude |
| `SYLVIE`     | Directrice Opérations            | Command Center, SLA, funnel analytics    |
| `ADMIN_IT`   | Administrateur Système           | Gestion agents, agences, config          |

> `ADMIN_IT` n'a **pas** de ligne dans la table `agents` — il ne traite pas de dossiers KYC.

## Comptes de démonstration (seed_data.py)

Ces comptes existent uniquement en `ENVIRONMENT=development` ou `SEED_DATA=true`.
Ils incarnent les personas UX du PRD pour les démos et tests.

| Persona demo   | Email             | Rôle     |
|----------------|-------------------|----------|
| Jean Dupont    | jean@bicec.cm     | `JEAN`   |
| Thomas Martin  | thomas@bicec.cm   | `THOMAS` |
| Sylvie Bernard | sylvie@bicec.cm   | `SYLVIE` |
| Admin IT       | admin@bicec.cm    | `ADMIN_IT` |

**En production**, un agent réel "Kouam Bertrand" aura `role=JEAN` dans la DB.
Son prénom n'est pas "Jean" — il exerce la fonction de validateur KYC.

## Ce qu'il ne faut pas faire

- Ne pas créer de logique métier qui suppose que `role=JEAN` implique que
  l'agent s'appelle "Jean".
- Ne pas confondre les comptes demo (`jean@bicec.cm`) avec le rôle fonctionnel
  (`JEAN`) — ce sont deux choses distinctes.
- Ne pas ajouter de nouveaux rôles sans mettre à jour la migration Alembic
  correspondante (l'enum PostgreSQL `agent_role` doit être synchronisé).
