# Chaîne de confiance CI du backend

La CI compile l'application une seule fois, puis construit une image Docker
immuable identifiée par le SHA Git. CodeQL analyse le code TypeScript, l'audit
pnpm contrôle les dépendances de production et Trivy bloque les secrets, les
configurations dangereuses et les vulnérabilités d'image HIGH ou CRITICAL.

Le bundle de promotion contient l'image Docker exportée, son SHA-256, son SBOM
SPDX JSON, le rapport de scan et une signature Sigstore keyless liée à l'identité
OIDC du workflow GitHub. Les environnements aval doivent importer exactement ce
tar, vérifier son empreinte et sa signature, puis le déployer sans reconstruction.

Exemple de vérification hors ligne après téléchargement du bundle :

```sh
sha256sum --check pms-backend.oci.sha256
cosign verify-blob pms-backend.oci.tar \
  --bundle pms-backend.oci.sigstore.json \
  --certificate-identity-regexp '^https://github.com/.+/.github/workflows/ci.yml@refs/heads/main$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
docker load --input pms-backend.oci.tar
```
