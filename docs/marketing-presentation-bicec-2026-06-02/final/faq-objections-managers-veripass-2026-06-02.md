# Mini FAQ - objections managers

## Est-ce que VeriPass remplace le jugement de la banque?

Non. La phrase centrale du deck est volontairement explicite: "VeriPass ne remplace pas le jugement de la banque. Il donne à la banque de meilleures preuves avant que le jugement soit rendu." La décision reste humaine et bancaire.

## Est-ce prêt pour la production BICEC?

Non. Le livrable présente un MVP fonctionnel et démontrable, pas une mise en production. Les revues conformité, sécurité, juridique, données personnelles, hébergement et exploitation restent à cadrer.

## Est-ce intégré au core banking?

Non. Aucune intégration core banking réelle n'est affirmée. Le pilote proposé doit rester borné et mesurable, sans provisioning bancaire.

## Est-ce connecté à la DGI, Sopra Amplitude ou Axway?

Non. Ces claims sont exclus du deck parce qu'ils ne sont pas prouvés par les docs/code actuels.

## Est-ce que VeriPass vérifie officiellement la CNI?

Non. Le MVP capture, extrait et structure autour de la CNI Cameroun. Il ne doit pas être présenté comme validation officielle contre une source d'autorité.

## Pourquoi parler de Cloudflare?

Uniquement pour la démonstration: l'accès mobile peut être exposé temporairement via un tunnel Cloudflare tant que la machine hôte tourne. Ce n'est pas une architecture de production.

## Où est le ROI?

Le deck refuse un ROI inventé. Il fournit un modèle de calcul et la liste des chiffres BICEC nécessaires. Le pilote sert à produire ces chiffres.

## Pourquoi limiter le périmètre à la CNI Cameroun?

Parce qu'un pilote crédible doit réduire le risque. CNI Cameroun d'abord permet de tester le rail KYC, la preuve, le backoffice, les alertes et le pilotage sans promettre passeport, permis ou multi-pays.

## Qu'est-ce que les managers gagnent concrètement?

Une vision plus structurée du flux KYC: dossiers mieux préparés, alertes visibles, traces auditables, files et SLA pilotables. Les gains chiffrés restent à mesurer avec la baseline BICEC.

## Quelle décision demander à la fin?

Autoriser le cadrage d'un pilote interne contrôlé: sponsor, données baseline, règles conformité, revue sécurité, critères go/no-go.

## Quel est le principal risque si le deck est mal présenté?

Surpromettre. Il faut éviter toute phrase qui ferait croire à une production immédiate, une validation officielle d'identité, une intégration bancaire réelle ou un ROI déjà acquis.

