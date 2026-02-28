import dotenv from "dotenv";
dotenv.config();
declare module "fastify" {
  interface FastifyInstance {
    ruleConfig: Record<string, any>;
  }
}

import Fastify, { FastifyInstance } from "fastify";
import redisPlugin from "./plugins/redis";
import postgresPlugin from "./plugins/postgres";
import healthRoute from "./routes/health";
import eventsRoute from "./routes/events";
import transactionsRoute from "./routes/transactions";
import fraudAlertsRoute from "./routes/fraudAlerts";
import ruleConfigRoute from "./routes/ruleConfig";
import dlqRoute from "./routes/dlq";
import metricsRoute from "./routes/metrics";




export async function buildApp() {
  const app = Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    },
    disableRequestLogging: true,
  });

  await app.register(redisPlugin);
  await app.register(postgresPlugin);

  await app.register(healthRoute);
  await app.register(eventsRoute);
  await app.register(transactionsRoute);
  await app.register(fraudAlertsRoute);
  await app.register(ruleConfigRoute);
  await app.register(dlqRoute);
  await app.register(metricsRoute);
  
  await loadRuleConfig(app);
  await setupRuleListener(app);
  

  return app;
}

import { Client } from "pg";

async function setupRuleListener(app: FastifyInstance) {
  let listenerClient: Client | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let reconnectDelay = 5000;

  const connect = async () => {
    try {
      listenerClient = new Client({
        connectionString: process.env.DATABASE_URL,
      });

      app.log.info("Attempting listener connection...");
      await listenerClient.connect();
      app.log.info("Listener connected successfully");
            await listenerClient.query("LISTEN rule_config_updated");

      app.log.info("🎧 Listening for rule config updates");

      reconnectDelay = 5000; // reset delay after success

      listenerClient.on("notification", async (msg) => {
        if (msg.channel === "rule_config_updated") {
          app.log.info("🔄 Rule config updated — reloading...");
          await loadRuleConfig(app);
        }
      });

      listenerClient.on("error", async (err) => {
        app.log.error("Listener connection lost. Reconnecting...");
        await cleanupAndReconnect();
      });

      listenerClient.on("end", async () => {
        app.log.warn("Listener connection ended. Reconnecting...");
        await cleanupAndReconnect();
      });

    } catch (err) {
      app.log.error("Listener connect failed. Retrying...");
      scheduleReconnect();
    }
  };

  const cleanupAndReconnect = async () => {
    if (listenerClient) {
      try {
        await listenerClient.end();
      } catch (_) {}
      listenerClient = null;
    }
    scheduleReconnect();
  };

  const scheduleReconnect = () => {
    if (reconnectTimeout) return; // prevent duplicate timers

    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      reconnectDelay = Math.min(reconnectDelay * 2, 30000); // max 30s
      connect();
    }, reconnectDelay);
  };

  await connect();
}
async function loadRuleConfig(app: FastifyInstance) {
  const result = await app.pg.query("SELECT * FROM rule_config");

  const configMap: Record<string, any> = {};

  for (const row of result.rows) {
    configMap[row.rule_type] = row;
  }

  app.ruleConfig = configMap;

  app.log.info("✅ Rule config loaded into memory");
}
