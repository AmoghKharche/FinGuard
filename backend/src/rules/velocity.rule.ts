import { FraudRule } from "./types";
import { randomUUID } from "crypto";

export const velocityRule: FraudRule = {
  ruleType: "VELOCITY_V1",

  async evaluate(app, client, event) {
    const cardKey = `velocity:${event.cardHash}`;
    const config = app.ruleConfig["VELOCITY_V1"];

    const limit = config.threshold!;
    const windowSeconds = config.window_seconds!;
    const severity = config.severity;

    const count = await app.redis.incr(cardKey);

    if (count === 1) {
      await app.redis.expire(cardKey, windowSeconds);
    }

    if (count > limit) {
      app.log.info(
        { cardHash: event.cardHash, count },
        "📊 Velocity counter updated"
      );

      if (count > limit) {
        const windowBucket = Math.floor(Date.now() / 60000);
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
          [alertId, event.cardHash, "VELOCITY_V1", windowBucket]
        );

        app.log.warn(
          { cardHash: event.cardHash },
          "🚨 Velocity fraud alert aggregated"
        );
        return {
          ruleType: "VELOCITY_V1",
          triggered: true,
          severity: severity,
        };
      }
      return {
        ruleType: "VELOCITY_V1",
        triggered: false,
        severity: 0,
      };
    }
  },
};
