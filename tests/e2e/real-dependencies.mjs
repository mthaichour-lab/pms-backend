import { randomUUID } from "node:crypto";

import { RabbitMqEventConsumer } from "../../dist/src/infrastructure/messaging/rabbitmq-event-consumer.adapter.js";
import { RabbitMqEventPublisher } from "../../dist/src/infrastructure/messaging/rabbitmq-event-publisher.adapter.js";

const apiUrl = required("PMS_API_URL");
const rabbitUrl = required("RABBITMQ_URL");
const correlationId = randomUUID();

const token = await obtainAccessToken();
await verifyOidcAndPostgres(token);
await verifyRabbitMq();

console.log(
  JSON.stringify({
    event: "e2e.real_dependencies.passed",
    dependencies: ["postgresql", "rabbitmq", "oidc"],
    correlationId,
  }),
);

async function obtainAccessToken() {
  const response = await fetch(required("OIDC_TOKEN_URL"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: required("OIDC_CLIENT_ID"),
      username: required("OIDC_TEST_USERNAME"),
      password: required("OIDC_TEST_PASSWORD"),
    }),
  });
  if (!response.ok)
    throw new Error(
      `OIDC token request failed with ${response.status}: ${await response.text()}`,
    );
  const payload = await response.json();
  if (
    typeof payload.access_token !== "string" ||
    payload.access_token.length === 0
  ) {
    throw new Error("OIDC provider returned no access token");
  }
  return payload.access_token;
}

async function verifyOidcAndPostgres(token) {
  const response = await fetch(
    `${apiUrl}/reference-data/currencies/DZD?businessDate=2026-01-01`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "x-correlation-id": correlationId,
      },
    },
  );
  if (!response.ok)
    throw new Error(
      `Authenticated PostgreSQL-backed API request failed with ${response.status}: ${await response.text()}`,
    );
  const currency = await response.json();
  if (currency.code !== "DZD" || currency.fractionDigits !== 2) {
    throw new Error(
      `Unexpected seeded currency response: ${JSON.stringify(currency)}`,
    );
  }
}

async function verifyRabbitMq() {
  const exchange = `pms.e2e.${randomUUID()}`;
  const eventId = randomUUID();
  const consumer = await RabbitMqEventConsumer.connect({
    url: rabbitUrl,
    exchange,
    queue: `${exchange}.queue`,
    routingKey: "e2e.probe",
    concurrency: 1,
  });
  const publisher = await RabbitMqEventPublisher.connect({
    url: rabbitUrl,
    exchange,
  });
  try {
    let resolveDelivery;
    let rejectDelivery;
    const received = new Promise((resolve, reject) => {
      resolveDelivery = resolve;
      rejectDelivery = reject;
    });
    const timeout = setTimeout(
      () => rejectDelivery(new Error("RabbitMQ delivery timed out")),
      10_000,
    );
    await consumer.start(async (message) => {
      clearTimeout(timeout);
      if (
        message.eventId !== eventId ||
        message.payload.probe !== "real-broker"
      ) {
        rejectDelivery(
          new Error(`Unexpected RabbitMQ message: ${JSON.stringify(message)}`),
        );
        return;
      }
      resolveDelivery();
    });
    await publisher.publish({
      eventId,
      eventType: "e2e.probe",
      correlationId,
      aggregateType: "E2eProbe",
      aggregateId: eventId,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      payload: { probe: "real-broker" },
    });
    await received;
  } finally {
    await publisher.close();
    await consumer.close();
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
