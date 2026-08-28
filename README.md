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

Les interfaces externes sont des ports afin de conserver Paperless, le stockage
WORM, le KMS/HSM et le broker hors du domaine.

Les adaptateurs disponibles couvrent Paperless (upload + suivi de tâche),
ClamAV INSTREAM, l'API WORM, RabbitMQ avec publisher confirms et PostgreSQL pour
les baux Outbox/Inbox. Le journal d'audit utilise une sérialisation canonique,
un hash chaîné et un adaptateur de signature KMS/HSM authentifié. Le
`document-worker` câble ces adaptateurs au consommateur RabbitMQ avec ACK/DLQ et
déduplication Inbox.

Le chart `deploy/helm/pms-backend` déploie l'API, les cinq unités asynchrones et
le Job `pms-db-migrate`. Il applique un filesystem en lecture seule, un contexte
non-root, des probes distinctes, l'anti-affinité et un PodDisruptionBudget.

## Structure cible

```text
apps/       api, workers et scheduler
src/        modules métier, shared-kernel et infrastructure
contracts/  OpenAPI, AsyncAPI et SDK publié
database/   migrations, référentiels et vérifications
deploy/     Helm et configurations d'environnements
docs/       ADR, runbooks et spécifications de calcul
```
