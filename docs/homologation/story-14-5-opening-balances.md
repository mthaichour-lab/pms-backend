# Story 14.5 — certification des soldes d'ouverture

La certification Finance rapproche quatre composantes obligatoires avec le grand livre : comptes et historiques, PER, IRR et distributions passées. Chaque ligne exige une référence de preuve et un écart strictement nul. Le dossier signé reçoit une empreinte SHA-256 et devient append-only.

`POST /accounting/opening-balances/certifications` enregistre la certification sous une identité Finance authentifiée. Les runs portent désormais un type explicite `PARALLEL` ou `PRODUCTION` (run réel). Un run `PRODUCTION` ne peut passer à `APPROVED`, `POSTED` ou `ARCHIVED` tant qu'aucune certification complète n'existe. Cette règle est appliquée dans le workflow et par le trigger PostgreSQL de la migration 054.

Les runs existants et ceux sans type explicite restent `PARALLEL`, ce qui évite de transformer implicitement une simulation en premier run réel.
