import {
  startTelemetry,
  stopTelemetry,
} from "../../../src/infrastructure/observability/opentelemetry.js";

startTelemetry({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "pms-api",
  serviceNamespace: "pms",
  environment: process.env.NODE_ENV ?? "development",
});

let stopping = false;
async function shutdownTelemetry(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await stopTelemetry();
}

process.once("SIGTERM", () => void shutdownTelemetry());
process.once("SIGINT", () => void shutdownTelemetry());
