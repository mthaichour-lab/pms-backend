import {
  startTelemetry,
  stopTelemetry,
} from "../../../src/infrastructure/observability/opentelemetry.js";

startTelemetry({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "pms-api",
  serviceNamespace: "pms",
  environment: process.env.NODE_ENV ?? "development",
});

let shutdownPromise: Promise<void> | undefined;

export function shutdownTelemetry(): Promise<void> {
  shutdownPromise ??= stopTelemetry();
  return shutdownPromise;
}
