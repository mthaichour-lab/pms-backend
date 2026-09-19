# Précontrôle PRA Docker

Le précontrôle ne déclenche aucune bascule. Il vérifie uniquement que la
configuration et l’hôte sont prêts pour l’exercice isolé.

```powershell
$env:DR_MODE = "ISOLATED_RESTORE_TEST"
$env:DR_CONTROL_TOKEN = "<secret approuvé>"
$env:CORE_DR_URL = "https://core-dr.example.internal"
$env:TOKEN_VAULT_DR_URL = "https://token-vault-dr.example.internal"
$env:DR_RPO_TARGET_MS = "300000"
$env:DR_RTO_TARGET_MS = "3600000"
pnpm dr:preflight
pnpm exec node deploy/dr/run-failover-drill.mjs
pnpm exec node deploy/dr/verify-failover-evidence.mjs deploy/dr/results/latest-failover-drill.json
```

Le jeton n’est jamais affiché ni écrit dans la preuve. L’exercice exige le
mode `ISOLATED_RESTORE_TEST`, un daemon Docker actif et les deux endpoints DR
du réseau d’administration. Toute preuve hors seuil RPO/RTO est rejetée.
