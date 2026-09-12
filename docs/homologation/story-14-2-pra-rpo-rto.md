# Story 14.2 — exercice PRA Core et Token Vault

Objectifs de travail retenus : RPO maximal de 5 minutes et RTO maximal de 60 minutes pour Core et Token Vault. Ils sont plus stricts que le plafond NFR global de quatre heures.

`pnpm dr:exercise` relève le watermark confirmé du primaire, déclenche une restauration/bascule isolée, attend le retour de l’état `ready`, relève le watermark restauré puis mesure la perte temporelle et la durée de reprise. Toute mesure hors seuil fait échouer l’exercice. Aucun secret ni donnée claire du Token Vault n’est écrit dans la preuve.

L’exercice technique isolé est planifié chaque trimestre. Un PRA complet organisationnel reste annuel et doit inclure DSI, RSSI, PCA/PRA, Métiers et Conformité. Les endpoints de contrôle DR doivent être exposés uniquement sur le réseau d’administration, protégés par identité de workload et désactivés sur l’interface publique.

Le runner ne peut pas être exécuté sur un poste sans Docker ni environnement de secours. Une preuve n’est valide que si elle provient du profil `dr-isolated` ou d’un site de secours approuvé.
