# ADR-016 — DDD comme langage commun

**Statut :** accepté  
**Date :** 2026-08-27

## Contexte

Le PMS porte des invariants financiers et réglementaires qui ne peuvent pas
être réduits au schéma relationnel. Un modèle guidé par les tables rendrait les
règles dépendantes de PostgreSQL et difficiles à vérifier sans infrastructure.

## Décision

Chaque module métier est un bounded context. Le domaine contient les agrégats,
value objects et invariants purs ; l'application orchestre les cas d'usage via
des ports ; PostgreSQL, RabbitMQ, NestJS et les API externes restent dans les
adaptateurs ou les composition roots.

Les contraintes `CHECK`, `FK`, `UNIQUE`, exclusions et triggers constituent une
seconde ligne de défense. Elles complètent les invariants du domaine sans les
remplacer.

## Alternative écartée — approche « table-driven » (Active Record)

Rejeter DDD et utiliser un ORM Active Record, par exemple Prisma directement
dans les contrôleurs.

Cette approche est écartée pour les raisons suivantes :

- couplage fort entre la base et l'API ;
- invariants noyés dans le code d'accès aux données ;
- impossibilité de tester unitairement le domaine sans base de données.

## Conséquences

- les contrôleurs dépendent des cas d'usage, jamais de Prisma ou de `pg` ;
- `src/modules/*/domain` ne dépend d'aucun framework ni adaptateur d'I/O ;
- `src/modules/*/application` définit ou consomme des ports, sans importer
  l'infrastructure ;
- les repositories PostgreSQL traduisent explicitement domaine et tables ;
- les invariants financiers possèdent des tests purs et une défense SQL lorsque
  cela est applicable ;
- les violations de ces frontières bloquent la CI.

## Vérification

Le test d'architecture `tests/architecture/ddd-boundaries.spec.ts` interdit les
imports de framework/ORM/I/O dans le domaine, les imports d'infrastructure dans
l'application et tout accès PostgreSQL/Prisma depuis un contrôleur.

## Revue de l'architecture V2 Active Record (août 2026)

La proposition `ARCHITECTURE-V2-ACTIVE-RECORD.md` ne remet pas en cause cette
décision : ses propres mitigations réintroduisent des fonctions pures, des
validateurs centralisés et des frontières de bounded contexts, tout en
conservant un couplage direct entre transport et persistance.

Les améliorations orthogonales retenues sont le cycle de migration
expand/migrate/backfill/switch/contract, les tests de migrations N-3 vers N, les
alertes SLO par burn rate multi-fenêtre, la gouvernance Charia des jeux d'or, la
validation stricte de configuration au démarrage et l'expiration des feature
flags. Elles s'appliquent à l'architecture DDD/hexagonale sans introduire Prisma
dans les contrôleurs.
