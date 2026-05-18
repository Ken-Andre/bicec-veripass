# Audit edge cases client d'abord

Date: 2026-05-16

Périmètre audité:
- `code/mobile`
- `code/backend/app/modules/auth`
- `code/backend/app/modules/kyc`
- `code/backend/app/tasks/kyc.py`

Méthode:
- croisement des états métier backend (`has_pin`, `is_deleted`, `status`, `access_level`, lockout/liveness, session expirée, abandon KYC) avec les décisions UI mobile
- recherche ciblée des reconstructions d'état local, du routing fondé sur cache local, et du traitement d'erreurs par texte

## Cas confirmés

### P0 - Réconciliation KYC efface le draft local sur 401/403 au lieu de déconnecter

- Surface impactée: `mobile` KYC hydration / reprise de dossier
- Preuve:
  - [code/mobile/src/contexts/KycContext.tsx:228](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\contexts\KycContext.tsx#L228) appelle `fetchWithCorrelation('/api/v1/kyc/session/current')`
  - [code/mobile/src/contexts/KycContext.tsx:244](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\contexts\KycContext.tsx#L244) traite tout `!res.ok` comme absence de session backend
  - [code/mobile/src/contexts/KycContext.tsx:249](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\contexts\KycContext.tsx#L249) efface l'état local si des étapes existent
  - [code/mobile/src/services/apiClient.ts:166](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\services\apiClient.ts#L166) `fetchWithCorrelation` n'applique pas le handler global de `401`
- Scénario de reproduction:
  1. L'utilisateur a un draft KYC local persisté.
  2. Son token est expiré ou invalide.
  3. Au prochain chargement, `/kyc/session/current` répond `401` ou `403`.
  4. Le mobile interprète la réponse comme "pas de session", efface le draft local et continue avec `reconciliationStatus='skipped'`.
- Source de vérité backend attendue:
  - `401` doit invalider la session locale et déclencher une reconnexion, pas un effacement silencieux du draft.
- Comportement actuel observé:
  - perte potentielle des données locales de reprise KYC
  - pas de redirection auth cohérente
- Cause probable:
  - utilisation d'un wrapper `fetch` qui ne partage pas la sémantique d'erreur de `apiClient`
  - confusion entre "aucune session KYC" et "session auth invalide"
- Correctif recommandé:
  - unifier les appels KYC critiques sur un chemin de gestion d'erreur qui distingue explicitement `401/403/404`
  - traiter `401` comme expiration de session, `403` comme état métier bloquant, `404`/`200 vide` comme absence réelle de session
  - ne jamais effacer un draft local sur un simple `!res.ok`
- Test de régression conseillé:
  - test d'hydratation KYC avec `/kyc/session/current` qui renvoie `401` et vérification que le draft n'est pas effacé silencieusement

### P0 - Connexion biométrique impossible: le mobile envoie `pin: 'biometric'` à un endpoint PIN strict

- Surface impactée: `mobile` auth biométrique
- Preuve:
  - [code/mobile/src/views/auth/PinLoginScreen.tsx:30](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\PinLoginScreen.tsx#L30) et [code/mobile/src/views/auth/PinLoginScreen.tsx:139](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\PinLoginScreen.tsx#L139) appellent `/auth/pin/verify` avec `pin: 'biometric'`
  - [code/backend/app/modules/auth/schemas.py:14](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\backend\app\modules\auth\schemas.py#L14) contraint le PIN à `^\d{6}$`
  - [code/backend/app/modules/auth/router.py:543](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\backend\app\modules\auth\router.py#L543) vérifie le hash du PIN réel
- Scénario de reproduction:
  1. L'utilisateur active la biométrie.
  2. Il tente une connexion biométrique.
  3. Le backend reçoit une valeur non conforme au contrat PIN.
- Source de vérité backend attendue:
  - soit un endpoint dédié à la biométrie, soit aucune promesse de login biométrique côté UI
- Comportement actuel observé:
  - le flux "connexion biométrique" ne peut pas réussir selon le contrat backend actuel
- Cause probable:
  - confusion entre authentification WebAuthn locale et authentification applicative backend
- Correctif recommandé:
  - désactiver le flux de login biométrique tant qu'aucun endpoint backend dédié n'existe
  - ou implémenter un vrai challenge/verify WebAuthn côté backend
- Test de régression conseillé:
  - test UI/logic qui interdit l'envoi de `pin: 'biometric'` vers `/auth/pin/verify`

### P1 - Le lock screen ne gère pas le `403 OTP requis` et le compte comme un simple échec PIN

- Surface impactée: `mobile` relock / reprise de session
- Preuve:
  - [code/backend/app/modules/auth/router.py:537](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\backend\app\modules\auth\router.py#L537) renvoie `403 PIN révoqué. Veuillez vous reconnecter via OTP.`
  - [code/mobile/src/views/auth/LockScreen.tsx:49](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\LockScreen.tsx#L49) ne distingue pas ce cas
  - [code/mobile/src/views/auth/LockScreen.tsx:69](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\LockScreen.tsx#L69) incrémente les tentatives comme si le PIN était faux
- Scénario de reproduction:
  1. L'utilisateur laisse expirer son contexte serveur ou son PIN est révoqué après abandon KYC.
  2. L'app se verrouille localement.
  3. Depuis l'écran lock, il ressaisit son vrai PIN.
  4. Le backend répond `403 OTP requis`.
  5. L'écran lock compte cela comme un mauvais PIN et peut finir en "compte bloqué".
- Source de vérité backend attendue:
  - un `403` métier "OTP requis" doit forcer une reconnexion complète, pas incrémenter les tentatives de PIN local
- Comportement actuel observé:
  - faux message d'erreur
  - risque de blocage UX et de mauvaise orientation utilisateur
- Cause probable:
  - gestion d'erreur uniquement par catégories "5xx" vs "tout le reste"
- Correctif recommandé:
  - traiter explicitement `error.status === 403` avec `detail` auth connu
  - rediriger vers le flux OTP complet
  - ne pas compter ce cas dans `attempts`
- Test de régression conseillé:
  - test de lock screen avec `/auth/pin/verify` qui renvoie `403 PIN révoqué...`

### P1 - Le login PIN dépend d'un matching de message texte pour détecter OTP requis

- Surface impactée: `mobile` login PIN
- Preuve:
  - [code/mobile/src/views/auth/PinLoginScreen.tsx:86](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\PinLoginScreen.tsx#L86) utilise `message.includes('OTP')`
  - [code/mobile/src/services/apiClient.ts:67](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\services\apiClient.ts#L67) expose déjà `error.status`
- Scénario de reproduction:
  1. Le backend renvoie toujours `403`, mais le message change de langue, de formulation ou de shape JSON.
  2. Le mobile ne reconnaît plus le cas "OTP requis".
  3. L'utilisateur voit "PIN incorrect" ou un autre fallback au lieu d'être redirigé proprement.
- Source de vérité backend attendue:
  - le routage doit dépendre d'un code d'erreur ou d'un statut, pas d'un fragment de texte
- Comportement actuel observé:
  - couplage fragile à une chaîne de caractères
- Cause probable:
  - classification d'erreur improvisée dans l'écran au lieu d'un contrat d'erreur partagé
- Correctif recommandé:
  - classifier via `error.status` et idéalement un `detail.code` backend stable
  - centraliser la lecture des erreurs auth dans un helper
- Test de régression conseillé:
  - test PinLogin avec `403` et variantes de message

### P1 - `HomePage` route vers PIN login à partir de `vp_user` sans revalidation serveur

- Surface impactée: `mobile` landing / reprise à froid
- Preuve:
  - [code/mobile/src/views/HomePage.tsx:82](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\HomePage.tsx#L82) lit `localStorage.getItem('vp_user')`
  - [code/mobile/src/views/HomePage.tsx:86](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\HomePage.tsx#L86) route directement vers `/auth/pin-login` si `has_pin`
  - [code/backend/app/tasks/kyc.py:102](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\backend\app\tasks\kyc.py#L102) peut révoquer le PIN côté serveur de façon asynchrone
- Scénario de reproduction:
  1. `vp_user.has_pin=true` reste en cache local.
  2. Le backend révoque le PIN entre-temps.
  3. Au redémarrage, la home renvoie quand même sur l'écran PIN.
- Source de vérité backend attendue:
  - l'état d'éligibilité PIN ne doit pas être déduit uniquement du cache local quand il peut changer côté serveur
- Comportement actuel observé:
  - mauvais écran d'entrée, puis correction tardive seulement après un échec serveur
- Cause probable:
  - priorité donnée à la fluidité locale sur la vérité serveur sans garde métier
- Correctif recommandé:
  - si aucun token valide n'est présent, éviter de faire du cache `has_pin` une vérité de navigation forte
  - préférer le flux OTP/login comme point d'entrée sûr, ou un pré-check serveur léger
- Test de régression conseillé:
  - test HomePage avec `vp_user.has_pin=true` mais PIN révoqué côté backend

### P1 - Le statut KYC post-submit reste localement `DRAFT/GUEST`, donc le polling review ne démarre pas

- Surface impactée: `mobile` KYC post-soumission / dashboard
- Preuve:
  - [code/backend/app/modules/kyc/router.py:1232](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\backend\app\modules\kyc\router.py#L1232) fait la transition `DRAFT -> PENDING_AGENT_REVIEW`
  - [code/mobile/src/views/kyc/ReviewScreen.tsx:195](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\kyc\ReviewScreen.tsx#L195) soumettait le dossier sans recopier `status/access_level` renvoyés par `/kyc/submit`
  - [code/mobile/src/contexts/KycContext.tsx:286](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\contexts\KycContext.tsx#L286) ne pollait que `PENDING` ou `SUBMITTED`, pas `PENDING_AGENT_REVIEW` ni `PENDING_INFO`
  - [code/mobile/src/views/dashboard/DashboardPage.tsx:57](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\dashboard\DashboardPage.tsx#L57) drive la vitrine depuis `accessLevel`
- Scénario de reproduction:
  1. L'utilisateur soumet un dossier KYC valide.
  2. Le backend renvoie `status=PENDING_AGENT_REVIEW` et `access_level=RESTRICTED`.
  3. Le mobile garde `status='DRAFT'` et `accessLevel='GUEST'`.
  4. Le polling review ne démarre pas et le dashboard reste sur un état local obsolète jusqu'au prochain reload.
- Source de vérité backend attendue:
  - la réponse de `/kyc/submit` doit immédiatement réaligner le contexte local sur `PENDING_AGENT_REVIEW/RESTRICTED`
- Comportement observé:
  - état local faux juste après soumission
  - bannière / gating dashboard potentiellement incohérents
- Cause probable:
  - transition backend non réinjectée dans `KycContext`
  - liste des statuts pollables restée sur des alias legacy
- Correctif recommandé:
  - recopier `status` et `access_level` de `/kyc/submit` dans le contexte
  - poller aussi `PENDING_AGENT_REVIEW`, `PENDING_KYC`, `PENDING_INFO`
- Statut:
  - corrigé dans [ReviewScreen.tsx](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\kyc\ReviewScreen.tsx) et [KycContext.tsx](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\contexts\KycContext.tsx)
- Test de régression conseillé:
  - test ReviewScreen qui vérifie que `/kyc/submit` applique immédiatement `PENDING_AGENT_REVIEW/RESTRICTED`

### P1 - Le cache `vp_user` reste obsolète après vérification d'email et le login PIN le propage

- Surface impactée: `mobile` auth / email verification / login PIN
- Preuve:
  - [code/backend/app/modules/auth/router.py:349](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\backend\app\modules\auth\router.py#L349) met à jour `current_user.email` dès `/auth/email/send`
  - [code/mobile/src/views/auth/EmailOtpVerifyScreen.tsx:65](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\EmailOtpVerifyScreen.tsx#L65) validait l'OTP email sans relire `/auth/me`
  - [code/mobile/src/views/auth/PinLoginScreen.tsx:60](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\PinLoginScreen.tsx#L60) reconstruisait ensuite `user` depuis le cache local au lieu d'utiliser la vérité serveur
  - [code/mobile/src/views/auth/ForgotPinScreen.tsx:91](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\ForgotPinScreen.tsx#L91) dépend de `user.email` pour activer le second facteur email
- Scénario de reproduction:
  1. L'utilisateur associe ou modifie son email.
  2. Le backend met à jour l'email, puis la vérification email réussit.
  3. Le mobile garde `vp_user.email` ancien ou nul.
  4. Un login PIN ultérieur recopie encore cet objet local obsolète.
- Source de vérité backend attendue:
  - après une mutation auth, le mobile doit relire `/auth/me` ou rafraîchir explicitement le cache utilisateur
- Comportement observé:
  - email local potentiellement périmé
  - flux `forgot-pin` et écrans auth basés sur `user.email` peuvent prendre une mauvaise branche
- Cause probable:
  - absence de stratégie unique de réconciliation post-auth
- Correctif recommandé:
  - ajouter un refresh utilisateur partagé
  - relire `/auth/me` après vérification email et après login PIN réussi
- Statut:
  - corrigé dans [AuthContext.tsx](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\contexts\AuthContext.tsx), [EmailOtpVerifyScreen.tsx](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\EmailOtpVerifyScreen.tsx) et [PinLoginScreen.tsx](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\auth\PinLoginScreen.tsx)
- Test de régression conseillé:
  - test EmailOtpVerify qui vérifie le refresh utilisateur
  - test PinLogin qui vérifie la relecture de `/auth/me`

## Cas à confirmer

### Faux positif écarté - `InfoRequestedScreen` force `GUEST`

- Observation:
  - [code/mobile/src/views/kyc/InfoRequestedScreen.tsx:33](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\mobile\src\views\kyc\InfoRequestedScreen.tsx#L33) met `setAccessLevel('GUEST')`
- Conclusion:
  - ce changement intervient après `/kyc/session/start`, donc sur une nouvelle session `DRAFT`
  - cela reste cohérent avec [code/backend/app/modules/kyc/schemas.py:38](C:\Users\yoann\Documents\School\Xp-X5\Stage\bicec-veripass\code\backend\app\modules\kyc\schemas.py#L38)
  - ce n'est pas retenu comme bug confirmé dans ce lot

## Recommandations transverses

- Introduire un contrat d'erreur backend stable pour auth/KYC (`code`, `status`, `retryable`) au lieu de dépendre de `detail` texte.
- Réduire les appels `fetchWithCorrelation` bruts sur les flux authentifiés ou leur ajouter la même sémantique que `apiClient`.
- Centraliser les transitions d'état utilisateur post-auth avec une seule stratégie de relecture serveur.
- Ajouter des tests de non-régression pour les transitions backend asynchrones:
  - PIN révoqué
  - compte supprimé
  - token expiré pendant reprise KYC
  - lock screen après invalidation serveur
