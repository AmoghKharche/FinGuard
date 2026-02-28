import { STREAMS, CONSUMER_GROUPS } from "../utils/constants";
import { FastifyInstance } from "fastify";
import { fraudRules } from "../rules";


export async function startTransactionWorker(app: FastifyInstance) {
  const stream = STREAMS.TRANSACTIONS;
  const group = CONSUMER_GROUPS.RISK_WORKERS;
  const consumerName = "worker-1";

  try {
    await app.redis.xgroup(
      "CREATE",
      stream,
      group,
      "0",
      "MKSTREAM"
    );
    app.log.info("Consumer group created");
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) {
      throw err;
    }
    app.log.info("Consumer group already exists");
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
      app.log.error("Worker error", err);
    }
  }
}
async function recoverPendingMessages(
  app: FastifyInstance,
  stream: string,
  group: string,
  consumerName: string
) {
  app.log.info("🔄 Checking for pending messages...");

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

  app.log.info("✅ Pending recovery complete");
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
        
        app.log.info(
            { decision },
        
          );        
          await client.query(
            `
            INSERT INTO transaction_decisions
            (transaction_id, risk_score, decision)
            VALUES ($1, $2, $3)
            `,
            [event.transactionId, riskScore, decision]
          );

      await client.query("COMMIT");
  
      app.log.info(
        { transactionId },
        "✅ Transaction fully processed"
      );
  
      await app.redis.xack(stream, group, id);
  
    } catch (err: any) {
      await client.query("ROLLBACK");
  
      if (err.code === "23505") {
        app.log.warn(
          { transactionId },
          "⚠️ Duplicate transaction skipped"
        );
  
        await app.redis.xack(stream, group, id);
        return;
      }
  
      app.log.error(err, "❌ Processing failed — will retry");
      // Do NOT ACK → retry later
    } finally {
      client.release();
    }
  }


//   async function applyVelocityRule(
//     app: FastifyInstance,
//     client: any,
//     event: any
//   ): Promise<boolean> {
//     const cardKey = `velocity:${event.cardHash}`;
  
//     const count = await app.redis.incr(cardKey);
  
//     if (count === 1) {
//       await app.redis.expire(cardKey, VELOCITY_RULE.WINDOW_SECONDS);
//     }
  
//     app.log.info(
//       { cardHash: event.cardHash, count },
//       "📊 Velocity counter updated"
//     );
  
//     if (count > VELOCITY_RULE.LIMIT) {

//         const windowBucket = Math.floor(Date.now() / 60000);
//         const alertId = randomUUID();
      
//         await client.query(
//           `
//           INSERT INTO fraud_alerts
//           (id, card_hash, rule_type, window_bucket, transaction_count)
//           VALUES ($1, $2, $3, $4, 1)
//           ON CONFLICT (card_hash, rule_type, window_bucket)
//           DO UPDATE
//           SET transaction_count = fraud_alerts.transaction_count + 1,
//               last_updated = NOW()
//           `,
//           [
//             alertId,
//             event.cardHash,
//             "VELOCITY_V1",
//             windowBucket
//           ]
//         );
      
//         app.log.warn(
//           { cardHash: event.cardHash, windowBucket },
//           "🚨 Velocity fraud alert aggregated"
//         );
      
//         return true;
//       }
  
//     return false;
//   }