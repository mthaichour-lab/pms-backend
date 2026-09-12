import { access, readFile } from "node:fs/promises";

const failures = [];
const entrypoints = [
  "dist/apps/api/src/main.js",
  "dist/apps/calculation-worker/src/main.js",
  "dist/apps/ingestion-worker/src/main.js",
  "dist/apps/closing-worker/src/main.js",
  "dist/apps/document-worker/src/main.js",
  "dist/apps/audit-worker/src/main.js",
  "dist/apps/scheduler/src/main.js",
  "dist/apps/db-migrate/src/main.js",
  "dist/apps/db-seed/src/main.js",
];
for (const entrypoint of entrypoints) {
  try {
    await access(entrypoint);
  } catch {
    failures.push(`missing built entrypoint: ${entrypoint}`);
  }
}

const dockerfile = await readFile("Dockerfile", "utf8");
for (const fragment of [
  "FROM node:24-alpine AS production-dependencies",
  "pnpm install --prod --frozen-lockfile --ignore-scripts",
  "COPY packages/pms-api-client/package.json",
  "USER pms",
])
  if (!dockerfile.includes(fragment))
    failures.push(`Dockerfile control: ${fragment}`);

const compose = await readFile("compose.yaml", "utf8");
for (const process of [
  "calculation-worker",
  "ingestion-worker",
  "closing-worker",
  "document-worker",
  "audit-worker",
  "scheduler",
]) {
  if (!compose.includes(`${process}:`))
    failures.push(`missing Compose service: ${process}`);
}
for (const fragment of [
  "read_only: true",
  "no-new-privileges:true",
  "cap_drop:",
  "service_completed_successfully",
  "healthcheck:",
  "init: true",
]) {
  if (!compose.includes(fragment))
    failures.push(`Docker Compose control: ${fragment}`);
}
const composeEnvironment = await readFile(".env.compose.example", "utf8");
for (const name of [
  "DATABASE_URL=",
  "RABBITMQ_URL=",
  "OIDC_ISSUER=",
  "PAPERLESS_URL=",
  "WORM_URL=",
  "KMS_URL=",
  "KMS_AUDIT_KEY_ID=",
  "KMS_WORKLOAD_TOKEN=",
  "TOKEN_VAULT_URL=",
  "TOKEN_VAULT_WORKLOAD_TOKEN=",
  "CBS_SOURCE_PUBLIC_KEYS_JSON=",
  "OTEL_SERVICE_NAME=",
  "OTEL_EXPORTER_OTLP_ENDPOINT=",
]) {
  if (!composeEnvironment.includes(name))
    failures.push(`missing Compose environment contract: ${name}`);
}

const localCompose = await readFile("compose.local.yaml", "utf8");
for (const service of [
  "postgres",
  "rabbitmq",
  "keycloak",
  "keycloak-bootstrap",
  "db-seed",
]) {
  if (!localCompose.includes(`${service}:`))
    failures.push(`missing local dependency: ${service}`);
}
for (const fragment of [
  "127.0.0.1:${POSTGRES_PORT:-5432}:5432",
  "condition: service_healthy",
  "service_completed_successfully",
  "*local-runtime",
]) {
  if (!localCompose.includes(fragment))
    failures.push(`local Compose control: ${fragment}`);
}
const localEnvironment = await readFile(".env.local.example", "utf8");
for (const name of [
  "POSTGRES_PASSWORD=",
  "RABBITMQ_PASSWORD=",
  "KEYCLOAK_ADMIN_PASSWORD=",
  "KEYCLOAK_DEV_PASSWORD=",
]) {
  if (!localEnvironment.includes(name))
    failures.push(`missing local environment contract: ${name}`);
}
const localRealm = JSON.parse(
  await readFile("deploy/keycloak/pms-dev-realm.json", "utf8"),
);
if (localRealm.realm !== "pms-dev" || localRealm.enabled !== true)
  failures.push("invalid local Keycloak realm");
if (JSON.stringify(localRealm).includes('"credentials"'))
  failures.push("local Keycloak realm must not embed user credentials");
const e2eClient = localRealm.clients?.find(
  (client) => client.clientId === "pms-e2e",
);
if (!e2eClient?.directAccessGrantsEnabled || !e2eClient.publicClient)
  failures.push(
    "missing public Keycloak client dedicated to automated E2E tests",
  );
const e2eCompose = await readFile("compose.e2e.yaml", "utf8");
for (const fragment of [
  "real-dependencies.mjs",
  "condition: service_healthy",
  "condition: service_completed_successfully",
  "no-new-privileges:true",
  "cap_drop:",
]) {
  if (!e2eCompose.includes(fragment))
    failures.push(`E2E Compose control: ${fragment}`);
}
const realE2e = await readFile("tests/e2e/real-dependencies.mjs", "utf8");
for (const fragment of [
  "OIDC_TOKEN_URL",
  "reference-data/currencies/DZD",
  "RabbitMqEventConsumer.connect",
  "RabbitMqEventPublisher.connect",
  "e2e.real_dependencies.passed",
]) {
  if (!realE2e.includes(fragment))
    failures.push(`real E2E dependency proof: ${fragment}`);
}

const observabilityCompose = await readFile(
  "compose.observability.yaml",
  "utf8",
);
for (const service of [
  "otel-collector",
  "prometheus",
  "alertmanager",
  "tempo",
  "loki",
  "grafana",
]) {
  if (!observabilityCompose.includes(`${service}:`))
    failures.push(`missing observability service: ${service}`);
}
for (const fragment of [
  "external: true",
  "no-new-privileges:true",
  "cap_drop:",
  "127.0.0.1:${GRAFANA_PORT:-3000}:3000",
]) {
  if (!observabilityCompose.includes(fragment))
    failures.push(`observability Compose control: ${fragment}`);
}
const backupCompose = await readFile("compose.backup.yaml", "utf8");
for (const service of [
  "backup-core",
  "backup-token-vault",
  "restore-core",
  "restore-token-vault",
]) {
  if (!backupCompose.includes(`${service}:`))
    failures.push(`missing backup service: ${service}`);
}
for (const fragment of [
  "pg_dump",
  "pg_restore --list",
  "sha256sum -c",
  "RESTORE_ISOLATED_TARGET",
  "--exit-on-error",
  "no-new-privileges:true",
]) {
  if (!backupCompose.includes(fragment))
    failures.push(`backup/restore control: ${fragment}`);
}
const backupEnvironment = await readFile(".env.backup.example", "utf8");
for (const name of [
  "PMS_BACKUP_DIRECTORY=",
  "BACKUP_ID=",
  "DATABASE_URL=",
  "TOKEN_VAULT_DATABASE_URL=",
  "CORE_RESTORE_DATABASE_URL=",
  "TOKEN_VAULT_RESTORE_DATABASE_URL=",
  "DR_RESTORE_CONFIRM=RESTORE_ISOLATED_TARGET",
]) {
  if (!backupEnvironment.includes(name))
    failures.push(`missing backup environment contract: ${name}`);
}
const instrumentation = await readFile(
  "apps/api/src/instrumentation.ts",
  "utf8",
);
for (const fragment of [
  "startTelemetry",
  "stopTelemetry",
  "SIGTERM",
  "pms-api",
]) {
  if (!instrumentation.includes(fragment))
    failures.push(`API telemetry lifecycle control: ${fragment}`);
}
const collector = await readFile(
  "deploy/observability/otel-collector.yml",
  "utf8",
);
for (const fragment of [
  "otlp/tempo",
  "prometheus",
  "otlphttp/loki",
  "receivers: [otlp]",
]) {
  if (!collector.includes(fragment))
    failures.push(`OpenTelemetry collector pipeline: ${fragment}`);
}
const prometheus = await readFile(
  "deploy/observability/prometheus.yml",
  "utf8",
);
for (const fragment of [
  "job_name: pms-api",
  "metrics_path: /api/metrics",
  "api:3001",
]) {
  if (!prometheus.includes(fragment))
    failures.push(`Prometheus API scrape control: ${fragment}`);
}
const alerts = await readFile("deploy/observability/alerts.yml", "utf8");
for (const fragment of [
  "PmsApiHighErrorRate",
  "PmsApiP95LatencyHigh",
  "pms_http_requests_total",
]) {
  if (!alerts.includes(fragment))
    failures.push(`Prometheus alert control: ${fragment}`);
}
const dashboard = JSON.parse(
  await readFile(
    "deploy/observability/grafana/dashboards/platform-overview.json",
    "utf8",
  ),
);
const dashboardMetrics = JSON.stringify(dashboard);
for (const metric of [
  "pms_http_requests_total",
  "pms_http_request_duration_milliseconds_bucket",
]) {
  if (!dashboardMetrics.includes(metric))
    failures.push(`Grafana dashboard metric: ${metric}`);
}
const loadHarness = await readFile(
  "performance/million-account-calculation.mjs",
  "utf8",
);
for (const fragment of [
  "1_000_000",
  "worker-thread-per-pool",
  "PMS_CLOSING_WINDOW_MS",
  "latest-million-account-run.json",
])
  if (!loadHarness.includes(fragment))
    failures.push(`load harness control: ${fragment}`);
const queueScaler = await readFile(
  "deploy/autoscaling/queue-depth-scaler.mjs",
  "utf8",
);
for (const fragment of [
  "messages_ready",
  "messages_unacknowledged",
  "CALCULATION_MESSAGES_PER_REPLICA",
  "--scale",
  "calculation-worker=",
])
  if (!queueScaler.includes(fragment))
    failures.push(`queue-depth scaler control: ${fragment}`);
const drRunner = await readFile("deploy/dr/run-failover-drill.mjs", "utf8");
for (const fragment of [
  "DR_RPO_TARGET_MS",
  "DR_RTO_TARGET_MS",
  "core",
  "token-vault",
  "sourceWatermark",
  "nextTechnicalRestoreDueAt",
])
  if (!drRunner.includes(fragment))
    failures.push(`DR exercise control: ${fragment}`);
const drWorkflow = await readFile(
  ".github/workflows/quarterly-dr-restore.yml",
  "utf8",
);
for (const fragment of [
  "cron: '0 2 1 1,4,7,10 *'",
  "ISOLATED_RESTORE_TEST",
  "retention-days: 365",
])
  if (!drWorkflow.includes(fragment))
    failures.push(`periodic DR workflow control: ${fragment}`);
const pentestGate = await readFile(
  "security/pentest/evaluate-pentest.mjs",
  "utf8",
);
for (const fragment of [
  "zap-report.json",
  "trivy-report.json",
  "manual-findings.json",
  "openCriticalCount",
  "BLOCKED",
])
  if (!pentestGate.includes(fragment))
    failures.push(`pentest gate control: ${fragment}`);
const pentestWorkflow = await readFile(
  ".github/workflows/preproduction-pentest.yml",
  "utf8",
);
for (const fragment of [
  "ZAP_IMAGE_BY_DIGEST",
  "PMS_PREPRODUCTION_IMAGE_BY_DIGEST",
  "pentest:gate",
  "retention-days: 365",
])
  if (!pentestWorkflow.includes(fragment))
    failures.push(`pentest workflow control: ${fragment}`);

if (failures.length) {
  console.error(
    `Runtime packaging verification failed:\n${failures.join("\n")}`,
  );
  process.exitCode = 1;
} else
  console.log(
    `${entrypoints.length} OCI entrypoints, application Compose and observability Compose verified.`,
  );
