# Simulation locale du parcours PRA

La simulation locale vérifie le flux de watermark, de bascule, de readiness et le calcul RPO/RTO sans contacter les endpoints DR réels.

```powershell
pnpm dr:simulate-local
```

Cette commande ne constitue pas une preuve d’homologation PRA. L’homologation exige le précontrôle avec `DR_MODE=ISOLATED_RESTORE_TEST`, les endpoints DR autorisés et le jeton d’administration.
