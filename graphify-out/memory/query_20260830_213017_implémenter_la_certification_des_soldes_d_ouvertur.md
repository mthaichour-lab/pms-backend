---
type: "query"
date: "2026-08-30T21:30:17.320572+00:00"
question: "Implémenter la certification des soldes d'ouverture migrés et bloquer le premier run réel"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ReconcileGeneralLedger", "PostgresWorkflowApprovalRepository", "calculation.run"]
---

# Q: Implémenter la certification des soldes d'ouverture migrés et bloquer le premier run réel

## Answer

Expansion vocabulaire: account accounting balance calculation ledger migration open profit reconcile reconciliation reserve run. Le graphe a identifié ReconcileGeneralLedger, PostgresWorkflowApprovalRepository et calculation.run comme points d'intégration. Implémentation: agrégat DDD de certification, persistance append-only, run_kind PRODUCTION et double garde applicatif/PostgreSQL avant APPROVED, POSTED ou ARCHIVED.

## Outcome

- Signal: useful

## Source Nodes

- ReconcileGeneralLedger
- PostgresWorkflowApprovalRepository
- calculation.run