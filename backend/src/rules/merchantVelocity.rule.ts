import { FraudRule } from "./types";
import { randomUUID } from "crypto";
import { metrics } from "../utils/metrics";

/**
 * Flags merchants that see unusually high transaction velocity in a short window.
 *
 * This is conceptually similar to VELOCITY_V1, but keyed on merchantId instead
 * of cardHash. It is useful for spotting compromised or abused merchants.
 *
 * Configuration (rule_config.rule_type = 'MERCHANT_VELOCITY_V1'):
 * - threshold: number of transactions allowed in the window
 * - window_seconds: size of the rolling time window in seconds
 * - severity: how much this rule contributes to the aggregate risk score
 */
export const merchantVelocityRule: FraudRule = {
  ruleType: "MERCHANT_VELOCITY_V1",

  async evaluate(app, client, event) {
    const config = app.ruleConfig["MERCHANT_VELOCITY_V1"];

    if (!config) {
      return {
        ruleType: "MERCHANT_VELOCITY_V1",
        triggered: false,
        severity: 0,
      };
    }

    const merchantId = event.merchantId;

    if (!merchantId) {
      return {
        ruleType: "MERCHANT_VELOCITY_V1",
        triggered: false,
        severity: 0,
      };
    }

    const limit = config.threshold!;
    const windowSeconds = config.window_seconds!;
    const severity = config.severity;

    const key = `merchant_velocity:${merchantId}`;
    const count = await app.redis.incr(key);

    if (count === 1) {
      await app.redis.expire(key, windowSeconds);
    }

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
        [
          alertId,
          event.cardHash,
          "MERCHANT_VELOCITY_V1",
          windowBucket,
        ]
      );

      app.log.warn(
        { merchantId, count },
        "Merchant velocity rule triggered"
      );
      metrics.incrementFraud("MERCHANT_VELOCITY_V1");

      return {
        ruleType: "MERCHANT_VELOCITY_V1",
        triggered: true,
        severity,
      };
    }

    return {
      ruleType: "MERCHANT_VELOCITY_V1",
      triggered: false,
      severity: 0,
    };
  },
};

