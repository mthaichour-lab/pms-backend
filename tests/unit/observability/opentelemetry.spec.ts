import { describe, expect, it } from "vitest";
import { otlpSignalUrl } from "../../../src/infrastructure/observability/opentelemetry.js";

describe("OpenTelemetry configuration", () => {
  it("builds canonical OTLP HTTP signal endpoints", () => {
    expect(otlpSignalUrl("http://otel-collector:4318/", "traces")).toBe(
      "http://otel-collector:4318/v1/traces",
    );
    expect(otlpSignalUrl("https://telemetry.example", "logs")).toBe(
      "https://telemetry.example/v1/logs",
    );
  });

  it("rejects unsupported collector protocols", () => {
    expect(() =>
      otlpSignalUrl("grpc://otel-collector:4317", "metrics"),
    ).toThrow("HTTP or HTTPS");
  });
});
