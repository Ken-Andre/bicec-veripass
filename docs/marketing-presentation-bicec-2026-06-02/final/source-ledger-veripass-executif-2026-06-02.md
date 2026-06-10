# Source ledger - VeriPass exécutif BICEC

Date: 2026-06-02  
Règle: un claim sans source reste `à valider`; un claim obsolète ou hors périmètre est `exclu`.

## Claims du deck

| Slide | Claim | Source | Statut | Formulation prudente |
|---|---|---|---|---|
| 1 | VeriPass est une base stratégique pour un rail KYC souverain, démontrable, auditable et mesurable. | `docs/documentation-authority.md`; `docs/project-overview.md`; `docs/architecture.md`; `docs/test-evidence/latest/` | prouvé | Base MVP et démonstration, pas production immédiate. |
| 1 | La demande est un pilote contrôlé, pas un déploiement. | `docs/marketing-presentation-bicec-2026-06-02/00_README.md`; `docs/documentation-authority.md` | prouvé | Décision de cadrage, pas go-live. |
| 2 | Les usages mobiles existent au Cameroun. | DataReportal/Kepios, [Digital 2026: Cameroon](https://datareportal.com/reports/digital-2026-cameroon), publié le 8 novembre 2025 | prouvé | 29,0 M connexions mobiles et 12,6 M internautes; ce ne sont pas des clients BICEC ni des personnes uniques pour les connexions. |
| 2 | Le contexte conformité reste sensible pour le Cameroun. | FATF/GAFI, [Cameroon country page](https://www.fatf-gafi.org/en/countries/detail/Cameroon.html), statut 13 février 2026 | prouvé | Contexte de surveillance accrue; ne signifie pas jugement sur BICEC. |
| 2 | Le paiement mobile est devenu massif dans la CEMAC. | BEAC/DSMP, [Rapport 2024 sur les services de paiement dans la CEMAC](https://www.beac.int/wp-content/uploads/2026/04/RAPPORT-SUR-LES-SERVICES-DE-PAIEMENT-DANS-LA-CEMAC-2024-.pdf), publié avril 2026 | prouvé | Contexte régional; ne pas convertir en adoption bancaire BICEC. |
| 3 | Dossiers incomplets, reprises, relances et preuve difficile créent une charge opérationnelle. | Déduit des workflows KYC actuels décrits dans `docs/project-overview.md` et des besoins de mesure dans `00_CHECKLIST_CHIFFRES_A_VALIDER.md` | à valider | Problème métier à quantifier avec données BICEC. |
| 4 | VeriPass structure un dossier avant décision humaine. | `docs/project-overview.md`, sections produit et workflow; `docs/documentation-authority.md` | prouvé | Le système assiste; il ne décide pas à la place de la banque. |
| 4 | Phrase centrale sur le jugement bancaire. | Positionnement utilisateur demandé et cohérent avec le périmètre produit actuel | prouvé | "Meilleures preuves" = mieux structurées, non validation officielle. |
| 5 | La matrice Direction/Réseau/Conformité/Audit/Opérations/IT/Finance/Digital est défendable. | Rôles et surfaces produits dans `docs/component-inventory.md`, `docs/project-overview.md`, captures backoffice | prouvé / à valider | Surfaces prouvées; gains organisationnels à mesurer. |
| 6 | Parcours mobile/PWA démontré. | Captures locales dans `docs/marketing-presentation-bicec-2026-06-02/`; `docs/test-evidence/latest/mobile/.last-run.json` | prouvé | Captures de démonstration, pas preuve d'accès production. |
| 6 | Périmètre documentaire limité à la CNI Cameroun. | `docs/test-evidence/latest/kyc-compliance-demo/README.md`; `docs/documentation-authority.md` | prouvé | Capture et structuration autour de la CNI; pas validation officielle par source d'autorité. |
| 7 | Backoffice agent et dossier structuré existent. | Captures backoffice Jean; `docs/test-evidence/latest/kyc-happy-path/README.md`, généré le 26/05/2026 | prouvé | Jean est un persona de démonstration. |
| 8 | Une alerte AML ouverte empêche l'approbation dans le MVP. | `docs/test-evidence/latest/kyc-compliance-demo/README.md`; `code/backend/app/modules/backoffice/router.py` | prouvé | Blocage MVP; règles finales à valider par Conformité BICEC. |
| 8 | Audit/export de preuve disponible. | `docs/test-evidence/latest/backoffice/cobac-audit-report-proof-final.json`; captures audit | prouvé | Export de preuve MVP, pas validation COBAC officielle. |
| 9 | Command center / analytics manager existent comme base. | Captures Sylvie; `docs/project-overview.md` | prouvé | Données réelles et SLA à brancher sur baseline BICEC. |
| 10 | Le ROI doit être calculé avec données BICEC. | `docs/marketing-presentation-bicec-2026-06-02/00_CHECKLIST_CHIFFRES_A_VALIDER.md` | à valider | Formules sans valeurs inventées. |
| 11 | Pilote interne de 8 à 12 semaines. | Recommandation de cadrage issue de la synthèse; pas source BICEC | à valider | Durée proposée, à valider avec sponsors. |
| 11 | Démonstration via Cloudflare Quick Tunnel tant que la machine hôte tourne. | `code/infra/cloudflare/README.md`; `code/docker-compose.yml` | prouvé | Démonstration temporaire, onboarding-only, pas production. |
| 12 | Décision demandée: sponsor, baseline data, revues conformité et sécurité. | Déduit des risques et critères de pilote; `docs/documentation-authority.md`; red-team QA | à valider | Gouvernance à confirmer par BICEC. |

## Sources externes vérifiées

| Source | Date | Utilisation | Prudence |
|---|---:|---|---|
| DataReportal/Kepios, [Digital 2026: Cameroon](https://datareportal.com/reports/digital-2026-cameroon) | 08/11/2025 | Contexte mobile/internet Cameroun | Ne pas assimiler connexions mobiles à personnes uniques ou clients bancaires. |
| FATF/GAFI, [Guidance on Digital ID](https://www.fatf-gafi.org/en/publications/Financialinclusionandnpoissues/Digital-identity-guidance.html) | 06/03/2020 | Cadre prudent: l'identité digitale peut contribuer au CDD si fiable et maîtrisée | Ne certifie pas VeriPass. |
| FATF/GAFI, [Cameroon country page](https://www.fatf-gafi.org/en/countries/detail/Cameroon.html) | 13/02/2026 | Contexte surveillance accrue | Ne pas formuler comme sanction BICEC. |
| BEAC/DSMP, [Rapport 2024 sur les services de paiement dans la CEMAC](https://www.beac.int/wp-content/uploads/2026/04/RAPPORT-SUR-LES-SERVICES-DE-PAIEMENT-DANS-LA-CEMAC-2024-.pdf) | 04/2026 | Contexte paiement mobile CEMAC | Contexte régional, pas ROI BICEC. |
| World Bank ID4D, [Diagnostic of ID Systems in Cameroon](https://openknowledge.worldbank.org/entities/publication/f5e9a8a2-0ede-463b-bf77-c02b92243c3a) | 23/01/2024 | Contexte friction identité | Chiffre pays, pas segmentation BICEC. |
| World Bank ID4D, [Global Dataset](https://id4d.worldbank.org/global-dataset) | 2025, données 2024 | Contexte mondial identité digitale | Non utilisé comme argument marché BICEC. |
| NIST, [SP 800-63-4 Digital Identity Guidelines](https://pages.nist.gov/800-63-4/) | 07/2025 | Benchmark assurance identité | Référence internationale, pas obligation locale BICEC. |
| Fenergo, [Fines Report 2025](https://resources.fenergo.com/reports/fenergo-fines-report-2025) | 2026 | Contexte pression réglementaire mondiale | Non utilisé pour chiffrer le risque BICEC. |
| Grand View Research, [Digital Identity Solutions Market](https://www.grandviewresearch.com/press-release/global-digital-identity-solutions-market) | 01/2026 | Contexte marché mondial | Non utilisé comme TAM ou ROI BICEC. |

## Claims exclus

| Claim | Statut | Raison |
|---|---|---|
| Intégration DGI active | exclu | Non prouvé dans les docs/code actuels; explicitement hors périmètre d'autorité. |
| Intégration Sopra Amplitude | exclu | Non prouvé; ne pas présenter comme fait actuel. |
| Intégration Axway | exclu | Non prouvé; ne pas présenter comme fait actuel. |
| Provisioning core banking réel | exclu | Hors périmètre actuel; le pilote proposé est sans intégration core banking. |
| Production immédiate BICEC | exclu | MVP démontrable uniquement; revues conformité/sécurité requises. |
| ROI chiffré BICEC | exclu | Aucun chiffre interne validé fourni. |
| Passeport, permis, multi-pays disponibles | exclu | Périmètre actuel cadré sur CNI Cameroun. |
| Décision bancaire automatique | exclu | Décision humaine maintenue. |
| Validation officielle de la CNI par une source d'autorité | exclu | Le MVP capture, extrait et structure; il ne prouve pas une vérification officielle externe. |

