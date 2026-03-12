import { FraudRule } from "./types";
import { randomUUID } from "crypto";
import { metrics } from "../utils/metrics";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/** Get hour (0-23) in Indian Standard Time from a Date (UTC). */
function getHourIST(date: Date): number {
  const istTime = new Date(date.getTime() + IST_OFFSET_MS);
  return istTime.getUTCHours();
}

/**
 * Flags transactions that occur within a configured time window in IST (e.g. 2 AM - 5 AM IST).
 * start_hour and end_hour are 0-23 in Indian Standard Time. Overnight windows supported (e.g. 22 to 6).
 */
function isInTimeWindow(hourIst: number, startHour: number, endHour: number): boolean {
  if (startHour <= endHour) {
    return hourIst >= startHour && hourIst <= endHour;
  }
  return hourIst >= startHour || hourIst <= endHour;
}

export const suspiciousHoursRule: FraudRule = {
  ruleType: "SUSPICIOUS_HOURS_V1",

  async evaluate(app, client, event) {
    const config = app.ruleConfig["SUSPICIOUS_HOURS_V1"];
    if (config?.start_hour == null || config?.end_hour == null) {
      return { ruleType: "SUSPICIOUS_HOURS_V1", triggered: false, severity: 0 };
    }
    const startHour = Number(config.start_hour);
    const endHour = Number(config.end_hour);
    const severity = config.severity;

    const ts = Number(event.timestamp);
    const date = ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
    const hourIst = getHourIST(date);

    if (!isInTimeWindow(hourIst, startHour, endHour)) {
      return { ruleType: "SUSPICIOUS_HOURS_V1", triggered: false, severity: 0 };
    }

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
      [alertId, event.cardHash, "SUSPICIOUS_HOURS_V1", windowBucket]
    );

    app.log.warn(
      { cardHash: event.cardHash, hourIst, startHour, endHour },
      "Suspicious hours rule triggered"
    );
    metrics.incrementFraud("SUSPICIOUS_HOURS_V1");
    return {
      ruleType: "SUSPICIOUS_HOURS_V1",
      triggered: true,
      severity,
    };
  },
};
