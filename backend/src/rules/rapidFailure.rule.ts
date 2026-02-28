import { FraudRule } from "./types";
import { randomUUID } from "crypto";
import { metrics } from "../utils/metrics";


export const rapidFailureRule: FraudRule = {
  ruleType: "RAPID_FAILURE_V1",

  async evaluate(app, client, event) {
    if (event.status !== "FAILED") return {
      ruleType: "RAPID_FAILURE_V1",
      triggered: false,
      severity: 0,
    };;

    const config = app.ruleConfig["RAPID_FAILURE_V1"];

    const limit = config.threshold!;
    const windowSeconds = config.window_seconds!;
    const severity = config.severity;

    const key = `failure:${event.cardHash}`;
    const count = await app.redis.incr(key);

    if (count === 1) {
      await app.redis.expire(key, windowSeconds);
    }

    if (count >= limit) {
      const windowBucket = Math.floor(
        Date.now() / (windowSeconds * 1000)
      );
      const alertId = randomUUID();

      await client.query(
        `
        INSERT INTO fraud_alerts
        (id, card_hash, rule_type, window_bucket, transaction_count)
        VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT (card_hash, rule_type, window_bucket)
        DO UPDATE
        SET transaction_count = fraud_alerts.transaction_count + 1,
            last_updated = NOW()
        `,
        [alertId, event.cardHash, "RAPID_FAILURE_V1", windowBucket]
      );

      app.log.warn(
        { cardHash: event.cardHash },
        "🚨 Rapid failure fraud alert"
      );
      metrics.incrementFraud("RAPID_FAILURE_V1");
      return {
        ruleType: "RAPID_FAILURE_V1",
        triggered: true,
        severity: severity,
      };
    }
    return {
      ruleType: "RAPID_FAILURE_V1",
      triggered: false,
      severity: 0,
    };
  },
};
