# Passage en homologation PRA réelle

## Prérequis

- Environnement GitHub Actions `dr-isolated` disponible.
- Secrets configurés dans cet environnement : `DR_CONTROL_TOKEN`, `CORE_DR_URL` et `TOKEN_VAULT_DR_URL`.
- Docker actif sur le runner.
- Fenêtres cibles validées : RPO maximal `300000` ms et RTO maximal `3600000` ms.

## Exécution

Le workflow trimestriel exécute automatiquement le précontrôle puis le drill :

```text
pnpm dr:preflight
pnpm dr:exercise
pnpm dr:verify deploy/dr/results/latest-failover-drill.json
```

## Critères de clôture

- Preflight réussi en mode `ISOLATED_RESTORE_TEST`.
- Watermark récupéré et readiness DR confirmée.
- RPO et RTO dans les seuils.
- Preuve générée sans secret et conservée comme artefact.
- Revue opérationnelle approuvée avant passage de la story 14.2 à `review`.

La simulation `pnpm dr:simulate-local` valide uniquement le flux local ; elle ne remplace pas cette homologation.
