import { shutdownTelemetry } from "./instrumentation.js";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app/app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = "api";
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.PORT || 3001;

  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (signal: NodeJS.Signals): Promise<void> => {
    shutdownPromise ??= (async () => {
      Logger.log(`Received ${signal}; shutting down the API`);
      let failed = false;
      try {
        // Closing Nest invokes lifecycle hooks, including the PostgreSQL pool shutdown.
        await app.close();
      } catch (error) {
        failed = true;
        Logger.error("Nest application shutdown failed", error);
      }
      try {
        // Flush telemetry last so shutdown spans are still exportable. This remains
        // independent from a failed Nest hook so exporters are never left running.
        await shutdownTelemetry();
      } catch (error) {
        failed = true;
        Logger.error("Telemetry shutdown failed", error);
      }
      if (failed) process.exitCode = 1;
    })();
    return shutdownPromise;
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  try {
    await app.listen(port);
  } catch (error) {
    await app.close().catch((closeError) => {
      Logger.error("API cleanup failed after startup error", closeError);
    });
    throw error;
  }
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap().catch(async (error) => {
  Logger.error("API startup failed", error);
  await shutdownTelemetry().catch((telemetryError) => {
    Logger.error("Telemetry shutdown failed after API startup error", telemetryError);
  });
  process.exitCode = 1;
});
