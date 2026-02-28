import { FraudRule } from "./types";
import { randomUUID } from "crypto";

const HIGH_AMOUNT_THRESHOLD = 500000;

export const highAmountRule: FraudRule = {
  ruleType: "HIGH_AMOUNT_V1",

  async evaluate(app, client, event) {
    const config = app.ruleConfig["HIGH_AMOUNT_V1"];
const threshold = config.threshold!;
const severity = config.severity;

if (event.amount > threshold) {

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
          "HIGH_AMOUNT_V1",
          windowBucket
        ]
      );

      app.log.warn(
        { cardHash: event.cardHash, amount: event.amount },
        "🚨 High amount fraud alert"
      );
      return {
        ruleType: "HIGH_AMOUNT_V1",
        triggered: true,
        severity: severity
      };
    }
    return {
        ruleType: "HIGH_AMOUNT_V1",
        triggered: false,
        severity: 0
      };
  }
};