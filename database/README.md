# Base de données PMS

Les migrations créent des schémas séparés par domaine. La migration initiale
pose les habilitations, l'Outbox/Inbox, les références Paperless/WORM et le
journal d'audit append-only.

`pnpm run database:verify` contrôle les invariants structurels sans remplacer
les futurs tests d'intégration exécutés sur PostgreSQL réel.
