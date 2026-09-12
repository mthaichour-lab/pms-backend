# Story 14.1 — preuve de capacité

Le test `pnpm performance:million` traite au moins 1 000 000 de comptes, partitionnés entre plusieurs pools exécutés en parallèle. Il échoue si le volume traité est inférieur à la cible ou si la durée dépasse `PMS_CLOSING_WINDOW_MS` (30 minutes par défaut). La preuve horodatée est écrite dans `performance/results/latest-million-account-run.json`.

Le harness mesure le chemin arithmétique déterministe et la conservation des poids sans charger un million d’objets en mémoire. Le test d’homologation final doit être exécuté dans le profil Docker de préproduction avec PostgreSQL et RabbitMQ dimensionnés comme la cible.

L’autoscaler `pnpm start:queue-scaler` lit `messages_ready + messages_unacknowledged` dans RabbitMQ Management et ajuste les réplicas Compose de `calculation-worker`. Il ne consulte pas le CPU. Les bornes, le ratio messages/réplica et le cooldown sont configurables par environnement.

Commande d’homologation :

```sh
PMS_LOAD_ACCOUNTS=1000000 PMS_LOAD_POOLS=8 PMS_CLOSING_WINDOW_MS=1800000 pnpm performance:million
```
