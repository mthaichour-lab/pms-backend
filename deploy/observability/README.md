# Observability

The local stack accepts OTLP traces, metrics, and logs on ports `4317` (gRPC)
and `4318` (HTTP). The collector routes traces to Tempo, metrics to Prometheus,
and logs to Loki. Grafana provisions all three data sources and the PMS Platform
Overview dashboard automatically.

The API exposes native Prometheus metrics at `/api/metrics`. Prometheus scrapes
that endpoint through the private `pms-network`; it is not published as a
separate host port.

Every deployed PMS process that emits OTLP telemetry must set:

```env
OTEL_SERVICE_NAME=pms-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=local,service.namespace=pms
```

Application logs must include `trace_id`, `span_id`, `service.name`, `severity`,
and `timestamp`. Never include access tokens, credentials, account identifiers,
or detokenized personal data.

Prometheus loads `alerts.yml` and forwards alerts to Alertmanager. Placeholder
recording rules reserve stable metric names for late CBS feeds, repeated
calculation failures, accounting imbalances, and critical parameter changes.
Production notification receivers remain environment-owned because their URLs
and credentials are secrets.

Start the application and observability stacks with:

```sh
docker compose up -d
docker compose -f compose.observability.yaml up -d
```

Grafana is then available on loopback port `3000`. Override its administrator
credentials with `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`.
