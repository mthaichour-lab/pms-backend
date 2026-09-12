# Déploiement Docker du PMS

## Préconditions

- Docker Engine et le plugin Docker Compose sur les hôtes privés ;
- accès au registre contenant les deux images signées ;
- PostgreSQL, RabbitMQ, Keycloak, Paperless, WORM et KMS joignables depuis
  l'hôte backend ;
- secrets fournis hors Git avec des permissions limitées au compte
  d'exploitation.

## Préparation

Dans `pms-backend`, copier `.env.compose.example` vers `.env.compose`, remplacer
toutes les valeurs `change-me`, puis limiter les permissions du fichier. Faire
la même opération dans `pms-frontend`.

Vérifier les modèles avant toute mutation :

```sh
docker compose --env-file .env.compose config --quiet
docker compose build
```

Le frontend rejoint le réseau `pms-network` créé par la stack backend. Le port
API est lié à `127.0.0.1` et n'est pas exposé au réseau utilisateur ; seul le
frontend doit être publié derrière le reverse proxy/WAF.

## Déploiement backend

```sh
docker compose run --rm db-migrate
docker compose up -d --no-deps api calculation-worker ingestion-worker \
  closing-worker document-worker scheduler
docker compose ps
```

La commande `up` normale respecte aussi la dépendance
`service_completed_successfully`, mais l'exécution explicite de la migration
facilite la revue des journaux avant démarrage applicatif.

## Déploiement frontend

```sh
cd ../pms-frontend
docker compose --env-file .env.compose config --quiet
docker compose up -d --build
docker compose ps
```

Contrôles de fumée :

```sh
curl --fail http://127.0.0.1:3001/api/health/ready
curl --fail http://127.0.0.1:3000/api/health
```

## Mise à jour et rollback

Publier un tag immuable pour chaque image, modifier `PMS_BACKEND_IMAGE` ou
`PMS_FRONTEND_IMAGE`, exécuter `docker compose pull`, puis recréer les services.
Ne jamais reconstruire entre recette et production.

Pour un rollback, restaurer les tags précédents et recréer les services. Une
migration DB n'est jamais annulée automatiquement : elle suit le modèle
expand/migrate/backfill/switch/contract et doit rester compatible N/N-1.

## Sauvegarde Core et Token Vault

La sauvegarde s'exécute depuis un hôte d'administration distinct. Copier
`.env.backup.example` vers `.env.backup`, injecter deux comptes PostgreSQL en
lecture seule et monter un stockage chiffré, immuable et répliqué sur
`PMS_BACKUP_DIRECTORY`. Le répertoire ne doit jamais se trouver dans Git.

```sh
docker compose --env-file .env.backup -f compose.backup.yaml --profile backup \
  run --rm backup-core
docker compose --env-file .env.backup -f compose.backup.yaml --profile backup \
  run --rm backup-token-vault
```

Chaque service produit une archive compressée et son fichier SHA-256, puis
exécute `pg_restore --list`. Copier ensemble l'archive et son checksum vers le
site de secours. Le stockage et le transfert doivent fournir le chiffrement ;
les fichiers Token Vault restent classés secrets même chiffrés.

## Restauration isolée et PRA multi-hôtes

Les URL `*_RESTORE_DATABASE_URL` doivent désigner des bases isolées, vides et
inaccessibles aux applications de production. La restauration refuse de
démarrer sans `DR_RESTORE_CONFIRM=RESTORE_ISOLATED_TARGET` et vérifie le
checksum avant toute mutation.

```sh
docker compose --env-file .env.backup -f compose.backup.yaml --profile restore \
  run --rm restore-core
docker compose --env-file .env.backup -f compose.backup.yaml --profile restore \
  run --rm restore-token-vault
```

Après restauration, déployer l'image backend signée sur l'hôte PRA, exécuter
les contrôles de santé et lancer `pnpm dr:exercise`, puis `pnpm dr:verify`.
Les hôtes applicatifs restent sans état ; seul un hôte actif consomme les files
RabbitMQ tant que la décision de bascule n'est pas approuvée. La réplication,
le fencing de l'ancien primaire, le DNS/WAF et l'ouverture réseau relèvent de
la procédure d'exploitation approuvée et doivent être consignés dans la preuve
PRA trimestrielle.

## Arrêt

```sh
docker compose stop
```

Ne pas utiliser `docker compose down -v` en production : l'option `-v` peut
supprimer des données persistantes gérées localement.
