import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
} from "@opentelemetry/semantic-conventions";

export interface TelemetryOptions {
  readonly serviceName: string;
  readonly serviceNamespace?: string;
  readonly environment?: string;
  readonly endpoint?: string;
  readonly metricExportIntervalMillis?: number;
}

let activeSdk: NodeSDK | undefined;

export function otlpSignalUrl(
  endpoint: string,
  signal: "traces" | "metrics" | "logs",
): string {
  const base = endpoint.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base))
    throw new TypeError("OTLP endpoint must use HTTP or HTTPS");
  return `${base}/v1/${signal}`;
}

export function startTelemetry(options: TelemetryOptions): NodeSDK | undefined {
  if (process.env.OTEL_SDK_DISABLED === "true") return undefined;
  if (activeSdk) return activeSdk;

  const endpoint =
    options.endpoint ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    "http://localhost:4318";
  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_NAMESPACE]: options.serviceNamespace ?? "pms",
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
        options.environment ?? process.env.NODE_ENV ?? "development",
    }),
  );

  activeSdk = new NodeSDK({
    resource,
    instrumentations: [getNodeAutoInstrumentations()],
    traceExporter: new OTLPTraceExporter({
      url: otlpSignalUrl(endpoint, "traces"),
    }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: otlpSignalUrl(endpoint, "metrics"),
        }),
        exportIntervalMillis: options.metricExportIntervalMillis ?? 15_000,
      }),
    ],
    logRecordProcessors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: otlpSignalUrl(endpoint, "logs"),
        }),
      }),
    ],
  });
  activeSdk.start();
  return activeSdk;
}

export async function stopTelemetry(): Promise<void> {
  const sdk = activeSdk;
  activeSdk = undefined;
  await sdk?.shutdown();
}
