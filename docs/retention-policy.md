# Politique de Rétention des Données Biométriques & Images KYC

## 1. Cadre Réglementaire
La présente politique définit les règles de conservation des images KYC (CNI, Passeports, Selfies, NIU) au sein de BICEC VeriPass, conformément aux exigences suivantes :

- **Loi n° 2024/017 du 24 juillet 2024** portant protection des données à caractère personnel au Cameroun.
- **Règlement COBAC R-2022/01** relatif à la vigilance en matière de lutte contre le blanchiment des capitaux et le financement du terrorisme (LCB-FT).
- **Directives de la DRSB (Direction du Contrôle Bancaire)** sur la conservation des archives bancaires.

## 2. Durée de Rétention
Toutes les pièces d'identité et les données biométriques collectées lors de l'enrôlement doivent être conservées pendant une durée de **10 ans** à compter de la clôture de la relation d'affaires ou de la dernière transaction.

## 3. Stratégie de Stockage & Souveraineté
Pour garantir la souveraineté des données biométriques et le respect de la Loi 2024-017 :

- **Pas de Cloud** : Aucune image KYC ne doit être stockée sur des services tiers (AWS, GCP, Azure) ou des serveurs hors du territoire national.
- **Stockage On-Prem** : Les données sont stockées sur des volumes Docker locaux chiffrés au sein de l'infrastructure de la BICEC.
- **Accès Restreint** : L'accès physique et logique aux répertoires de stockage est limité aux administrateurs système et aux auditeurs habilités.

## 4. Politique de Backup Chiffré
Un système de sauvegarde automatisé est en place pour prévenir toute perte de données :

- **Fréquence** : Hebdomadaire (tous les dimanches à 02:00 AM).
- **Format** : Archive `tar.gz` chiffrée via `GPG` (AES-256).
- **Emplacement** : `/backups/images/` sur le serveur local de production.
- **Rotation** :
    - Conservation des **4 dernières semaines**.
    - Conservation d'**une archive mensuelle** pendant les **12 derniers mois**.
    - Archivage à froid (bandes/fichiers chiffrés hors ligne) pour la conformité 10 ans.

## 5. Audit & Intégrité
- Chaque backup génère une empreinte **SHA-256** enregistrée dans la table `audit_log` de la base de données.
- Toute tentative d'accès ou d'extraction manuelle des données de backup est tracée et soumise à une alerte critique.
