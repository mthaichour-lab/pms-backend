# Revue de la proposition Architecture V2 Active Record

Date : 2026-08-28

## Décision

La proposition est retenue comme source d'améliorations opérationnelles, mais
son choix central — Prisma directement dans les contrôleurs — est rejeté selon
l'ADR-016. Pour un PMS bancaire, les calculs, transitions Maker/Checker,
contrepassations et rapprochements doivent rester vérifiables sans base de
données et indépendants du transport HTTP.

## Éléments retenus

- migrations en cinq phases : expand, migrate/double-write, backfill, switch,
  contract, avec deux sprints minimum avant suppression et validation DBA ;
- tests de migration d'une version N-3 vers N ;
- jeux d'or versionnés dont les changements exigent une approbation Charia ;
- alertes SLO par burn rate multi-fenêtre ;
- validation stricte de la configuration avant démarrage ;
- feature flags serveur audités, expirant sous 90 jours et interdits pour
  sélectionner une formule financière ;
- maintien des DTO stricts, RFC 7807, idempotence des mutations, ETag/If-Match,
  SDK contract-first, promotion du même artefact et contrôles de supply chain.

## Éléments non retenus

- Prisma ou `pg` dans les contrôleurs NestJS ;
- modèle de persistance comme contrat API ou source du langage métier ;
- remplacement des tests unitaires du domaine par des tests DB-backed ;
- invariants uniquement portés par helpers de contrôleur et triggers ;
- transactions métier longues orchestrées dans la couche HTTP.

Les contraintes PostgreSQL restent une seconde ligne de défense. Les tests
d'intégration DB et les tests de contrat complètent les tests purs du domaine,
ils ne les remplacent pas.
