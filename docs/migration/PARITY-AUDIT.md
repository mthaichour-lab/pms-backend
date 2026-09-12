# Audit de parité avant retrait de `pms-platform`

Date : 2026-08-29

## Résultat

Le retrait de l'ancien monorepo n'est pas encore autorisé. Les applications,
contrats et fonctions métier ont été extraits vers `pms-backend` et
`pms-frontend`, mais les contrôles ci-dessous restent ouverts.

## Parité acquise

- frontend Next.js/BFF, session Keycloak et rôles ;
- realm Keycloak local sans identifiants statiques et bootstrap par variables ;
- API NestJS, workers, scheduler et migrations ;
- OpenAPI, AsyncAPI et SDK versionné ;
- calcul, ingestion, clôture, documents, comptabilité, conformité, risque et
  reporting ;
- instrumentation OpenTelemetry de l’API et pipelines Prometheus/Loki/Tempo ;
- seed PostgreSQL local idempotent exécuté après les migrations par un service
  Docker one-shot dédié ;
- sauvegarde et restauration Docker de Core et Token Vault avec archives
  compressées, checksums et confirmation de cible PRA isolée ;
- images OCI, stacks Docker Compose et smoke tests des artefacts compilés ;
- scénario E2E Docker exécuté en CI avec PostgreSQL, RabbitMQ et Keycloak réels :
  jeton OIDC signé, lecture API adossée à PostgreSQL et livraison confirmée par
  le broker.

## Éléments à migrer ou remplacer

Aucun écart fonctionnel connu dans le périmètre backend audité. Le retrait reste
conditionné aux validations organisationnelles et de sécurité ci-dessous.

## Incident de secret

Le dépôt `pms-platform` suit dans Git un fichier de 419 octets détecté comme
clé privée OpenSSH, ainsi que sa clé publique. La suppression du fichier dans
le dernier commit ne suffit pas : la clé doit être considérée compromise,
révoquée auprès de tous les systèmes où elle a pu être autorisée, remplacée,
puis retirée de l'historique Git avec une procédure validée par le responsable
du dépôt. Aucun de ces fichiers ne doit être copié vers les nouveaux dépôts.

## Condition de retrait

Le monorepo ne pourra être archivé qu'après fermeture des éléments ci-dessus,
validation des deux pipelines Docker et preuve qu'aucun consommateur ne dépend
encore de ses packages ou chemins Nx.
