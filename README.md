# pms-backend

Backend du PMS bancaire : monolithe modulaire NestJS, workers spécialisés,
contrats OpenAPI/AsyncAPI, domaine financier, migrations et intégrations.

Ce dépôt est initialisé de manière additive depuis le workspace transitoire
`pms-platform`. L'historique existant reste intact jusqu'à validation complète
de l'extraction.

## État exécutable

- API NestJS sous `apps/api` ;
- workers spécialisés et scheduler sous `apps/` ;
- module IAM/RBAC/ABAC sous `src/modules/identity-access` ;
- Outbox/Inbox et runtime partagé sous `src/infrastructure` ;
- migrations PostgreSQL sous `database/migrations` ;
- SDK généré et publiable sous `packages/pms-api-client`.
- module documentaire antivirus/Paperless/WORM sous `src/modules/documents`.
- référentiels de devises versionnés et exposés par contrat à date métier ;
- ingestion CBS avec registre idempotent, checksum, antivirus, quarantaine,
  staging séparé, contrôles de masse et publication transactionnelle ;
- socle financier `Money` sans flottants et agrégat initial des comptes
  d'investissement avec identifiants clients tokenisés.
- allocation proportionnelle exacte par méthode du plus grand reste, avec
  conservation garantie de chaque unité monétaire.
- `calculation-worker` transactionnel avec snapshot, empreintes d'entrée/sortie,
  contrôle SQL de conservation et consultation contractuelle des runs ;
- `closing-worker` avec contrôles bloquants CBS/calcul avant Maker/Checker.
- transitions Maker/Checker des calculs et clôtures avec acteur issu du JWT,
  justification obligatoire et idempotence ; l’intention d’audit est inscrite
  dans le même commit PostgreSQL via l’Outbox ;
- `audit-worker` sérialise les intentions, déduplique les livraisons Inbox,
  signe chaque événement via KMS/HSM et prolonge la chaîne append-only ;
- consultation du journal avec filtres contractuels, fenêtre globale bornée et
  vérification du hash ainsi que du prédécesseur chronologique immédiat avant
  projection des résultats.
- instrumentation OpenTelemetry réelle de l’API avec export OTLP des traces,
  métriques et journaux vers le collecteur Docker.

Les interfaces externes sont des ports afin de conserver Paperless, le stockage
WORM, le KMS/HSM et le broker hors du domaine.

Les adaptateurs disponibles couvrent Paperless (upload + suivi de tâche),
ClamAV INSTREAM, l'API WORM, RabbitMQ avec publisher confirms et PostgreSQL pour
les baux Outbox/Inbox. Le journal d'audit utilise une sérialisation canonique,
un hash chaîné et un adaptateur de signature KMS/HSM authentifié. Le
`document-worker` et `audit-worker` câblent ces adaptateurs aux consommateurs
RabbitMQ avec ACK/DLQ et déduplication Inbox.

L'[ADR-016](docs/adr/ADR-016-ddd-as-common-language.md) impose DDD comme langage
commun. Les contrôleurs ne peuvent pas accéder directement à PostgreSQL ou à un
ORM Active Record ; un test d'architecture bloque ces violations en CI.

Le fichier `compose.yaml` déploie l'API, les cinq unités asynchrones et le
service one-shot `db-migrate`. Les conteneurs sont non-root, en lecture seule,
sans privilèges ni capabilities Linux, avec limites de ressources et
healthcheck API. Copier `.env.compose.example` vers `.env.compose`, injecter les
secrets réels, puis exécuter `docker compose up -d --build`.

Pour un environnement local autonome, copier aussi `.env.local.example` vers
`.env.local`, remplacer ses mots de passe, puis lancer :

```sh
docker compose --env-file .env.local -f compose.yaml -f compose.local.yaml --profile local-seed up -d --build
```

Ce profil ajoute PostgreSQL, RabbitMQ et Keycloak sur l'interface loopback. Il
reste strictement destiné au poste de développement et ne remplace pas le
profil de déploiement durci.

Le profil `local-seed` exécute le service one-shot `db-seed` après les
migrations. Les devises, le produit de démonstration, le client tokenisé et les
trois pools sont insérés de manière idempotente ; aucune donnée personnelle
réelle n'est embarquée.

Le service one-shot `keycloak-bootstrap` crée ou actualise l'utilisateur local
défini par `KEYCLOAK_DEV_USER` et `KEYCLOAK_DEV_PASSWORD`. Aucun identifiant
utilisateur n'est stocké dans l'export du realm.

Le scénario d'intégration réel obtient un jeton signé par Keycloak, vérifie une
lecture PostgreSQL via l'API puis une livraison RabbitMQ. Il utilise uniquement
les identifiants locaux définis dans `.env.local` :

```sh
cp .env.compose.example .env.compose
pnpm run e2e:real
pnpm run e2e:real:down
```

## Structure cible

```text
apps/       api, workers et scheduler
src/        modules métier, shared-kernel et infrastructure
contracts/  OpenAPI, AsyncAPI et SDK publié
database/   migrations, référentiels et vérifications
deploy/     vérifications du packaging Docker
docs/       ADR, runbooks et spécifications de calcul
```
