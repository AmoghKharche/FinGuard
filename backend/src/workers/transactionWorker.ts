import { STREAMS, CONSUMER_GROUPS } from "../utils/constants";
import { FastifyInstance } from "fastify";
import { fraudRules } from "../rules";
import { metrics } from "../utils/metrics";

const MAX_RETRIES = 5;
const DLQ_STREAM = "transactions_dlq";

export async function startTransactionWorker(app: FastifyInstance) {
  const stream = STREAMS.TRANSACTIONS;
  const group = CONSUMER_GROUPS.RISK_WORKERS;
  const consumerName = "worker-1";

  try {
    await app.redis.xgroup("CREATE", stream, group, "0", "MKSTREAM");
    app.log.info("Transaction consumer group created");
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) {
      throw err;
    }
    app.log.info("Transaction consumer group already exists");
  }
  await recoverPendingMessages(app, stream, group, consumerName);

  while (true) {
    try {
      const response = await app.redis.xreadgroup(
        "GROUP",
        group,
        consumerName,
        "BLOCK",
        5000,
        "COUNT",
        10,
        "STREAMS",
        stream,
        ">"
      );

      if (!response) continue;

      for (const [streamName, messages] of response) {
        for (const [id, fields] of messages) {
          const event = parseFields(fields);
          await processEvent(app, stream, group, id, event);
        }
      }
    } catch (err) {
      metrics.incrementWorkerError();
      app.log.error({ err }, "Worker read error");
    }    
  }
}
async function recoverPendingMessages(
  app: FastifyInstance,
  stream: string,
  group: string,
  consumerName: string
) {
  app.log.debug("Recovering pending messages");

  let cursor = "0-0";

  while (true) {
    const result = await app.redis.xautoclaim(
      stream,
      group,
      consumerName,
      5000, // idle time threshold in ms
      cursor,
      "COUNT",
      10
    );

    const [nextCursor, messages] = result;

    if (!messages.length) break;

    for (const [id, fields] of messages) {
      const event = parseFields(fields);

      await processEvent(app, stream, group, id, event);
    }

    cursor = nextCursor;

    if (cursor === "0-0") break;
  }

  app.log.info("Pending message recovery complete");
}
function parseFields(fields: string[]) {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]] = fields[i + 1];
  }
  return obj;
}
async function processEvent(
  app: FastifyInstance,
  stream: string,
  group: string,
  id: string,
  event: any
) {
  const client = await app.pg.connect();
  const transactionId = event.transactionId;

  try {
    await client.query("BEGIN");
    // 1️⃣ Idempotency check
    await client.query(
      "INSERT INTO processed_transactions (transaction_id) VALUES ($1)",
      [transactionId]
    );

    // 2️⃣ Apply rules
    let riskScore = 0;

    for (const rule of fraudRules) {
      const result = await rule.evaluate(app, client, event);

      if (result.triggered) {
        riskScore += result.severity;
      }
    }
    let decision = "APPROVED";

    if (riskScore >= 5) {
      decision = "DECLINED";
    } else if (riskScore >= 2) {
      decision = "REVIEW";
    }
    app.log.debug({ transactionId, decision, riskScore }, "Transaction decision");
    await client.query(
      `
            INSERT INTO transaction_decisions
            (transaction_id, risk_score, decision)
            VALUES ($1, $2, $3)
            `,
      [event.transactionId, riskScore, decision]
    );
    
    await client.query("COMMIT");
    metrics.incrementTransaction(decision);

    // Broadcast updated metrics to connected dashboard clients
    const clients = app.metricClients;
    if (clients && clients.size > 0) {
      const snapshot = metrics.snapshot();
      for (const client of clients) {
        (client as { send: (data: string) => void }).send(JSON.stringify({
          type: "metrics_update",
          data: snapshot
        }));
      }
    }

    await app.redis.xack(stream, group, id);
  } catch (err: any) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      app.log.warn({ transactionId }, "Duplicate transaction skipped");

      await app.redis.xack(stream, group, id);
      return;
    }

    const retryKey = `retry:${id}`;
    const retryCount = await app.redis.incr(retryKey);
    metrics.incrementRetry();
    // Safety TTL to avoid memory leak
    await app.redis.expire(retryKey, 3600);

    app.log.error(
      {
        transactionId,
        retryCount,
        message: err.message,
        code: err.code
      },
      "Transaction processing failed"
    );
    if (retryCount > MAX_RETRIES) {
      app.log.error(
        { transactionId, retryCount },
        "Max retries exceeded, moving to DLQ"
      );

      await app.redis.xadd(
        DLQ_STREAM,
        "*",
        "payload",
        JSON.stringify({
          originalEvent: event,
          errorMessage: err.message,
          retryCount,
          failedAt: new Date().toISOString(),
        })
      );

      metrics.incrementDLQ();

      await app.redis.xack(stream, group, id);
      await app.redis.del(retryKey);
    } else {
      app.log.warn({ transactionId, retryCount }, "Message will be retried");
      // Do NOT ACK → will be reclaimed
    }
  } finally {
    client.release();
  }
}
