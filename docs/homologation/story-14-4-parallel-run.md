# Story 14.4 — calcul parallèle et rapport d'écarts

Le dossier d'une campagne contient `campaign.json`, `pms-results.json`, `manual-results.json` et `signoffs.json`. La commande `pnpm parallel-run:gate -- <dossier>` produit `parallel-run-report.json`, compare chaque couple compte/devise en centimes et bloque la bascule tant que Finance, Charia et Audit n'ont pas signé.

Le statut de l'ancien outil doit rester `ACTIVE`. Le gate n'autorise donc jamais son décommissionnement ; il autorise uniquement la décision de bascule progressive lorsque le rapport formel et ses trois validations sont présents. Les écarts restent explicitement consignés dans le rapport signé.

La fixture démontre également qu'un écart de montant est conservé sans être masqué. Les fichiers de campagne réels doivent être archivés dans le dossier d'homologation avec leurs preuves de signature.
