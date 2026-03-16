export type TransactionStatus = 'APPROVED' | 'FAILED';

export interface TransactionEventPayload {
  merchantId: string;
  transactionId: string;
  amount: number;
  status: TransactionStatus;
  cardHash: string;
  timestamp?: number | string;
}

export interface TransactionScenario {
  id: string;
  name: string;
  description: string;
  notes?: string;
  generateEvents: () => TransactionEventPayload[]; // some scenarios will emit multiple events
}

const now = () => Date.now();

/**
 * Build scenarios using the current backend rule config so
 * amounts and patterns stay relative to thresholds.
 */
export function buildScenarios(ruleConfig: any): TransactionScenario[] {
  const highAmountCfg = ruleConfig?.HIGH_AMOUNT_V1;
  const rapidFailureCfg = ruleConfig?.RAPID_FAILURE_V1;
  const suspiciousHoursCfg = ruleConfig?.SUSPICIOUS_HOURS_V1;
  const merchantVelocityCfg = ruleConfig?.MERCHANT_VELOCITY_V1;

  const highAmountThreshold = Number(highAmountCfg?.threshold ?? 5000);
  const rapidFailureThreshold = Number(rapidFailureCfg?.threshold ?? 4);
  const rapidFailureWindowSeconds = Number(rapidFailureCfg?.window_seconds ?? 60);
  const merchantVelocityThreshold = Number(merchantVelocityCfg?.threshold ?? 5);
  const suspiciousStartHour = Number(suspiciousHoursCfg?.start_hour ?? 2);

  return [
    {
      id: 'high-amount-single',
      name: 'High amount single purchase',
      description: 'One large approved purchase slightly above the HIGH_AMOUNT_V1 threshold.',
      notes: `Uses an amount just above the configured HIGH_AMOUNT_V1.threshold (${highAmountThreshold}).`,
      generateEvents: () => [
        {
          merchantId: 'merchant_high_amount',
          transactionId: `tx-high-${now()}`,
          amount: highAmountThreshold + Math.max(1, Math.round(highAmountThreshold * 0.1)),
          status: 'APPROVED',
          cardHash: 'card_high_amount',
          timestamp: now()
        }
      ]
    },
    {
      id: 'rapid-failures',
      name: 'Rapid consecutive failures',
      description: 'Several failed attempts on the same card within the RAPID_FAILURE_V1 window.',
      notes: `Sends slightly more FAILED attempts than RAPID_FAILURE_V1.threshold (${rapidFailureThreshold}) in its window.`,
      generateEvents: () => {
        const base = now();
        const count = rapidFailureThreshold + 1;
        const spacingMs = Math.max(1_000, (rapidFailureWindowSeconds * 1000) / Math.max(count, 1));
        return Array.from({ length: count }).map((_, idx) => ({
          merchantId: 'merchant_rapid_failure',
          transactionId: `tx-fail-${base}-${idx + 1}`,
          amount: 50,
          status: 'FAILED',
          cardHash: 'card_rapid_failure',
          timestamp: base + idx * spacingMs
        }));
      }
    },
    {
      id: 'night-time-suspicious',
      name: 'Night-time suspicious purchase',
      description: 'A purchase at a suspicious hour intended to exercise SUSPICIOUS_HOURS_V1.',
      notes: `Uses a timestamp around the configured suspicious window (e.g. start_hour=${suspiciousStartHour}).`,
      generateEvents: () => {
        const d = new Date();
        d.setHours(suspiciousStartHour || 2, 0, 0, 0);
        return [
          {
            merchantId: 'merchant_night',
            transactionId: `tx-night-${now()}`,
            amount: Math.max(100, Math.round(highAmountThreshold * 0.2)),
            status: 'APPROVED',
            cardHash: 'card_night',
            timestamp: d.getTime()
          }
        ];
      }
    },
    {
      id: 'merchant-velocity',
      name: 'Merchant velocity spike',
      description: 'Burst of purchases at the same merchant to exercise merchant/velocity rules.',
      notes: `Sends a few more events than MERCHANT_VELOCITY_V1.threshold (${merchantVelocityThreshold}) in a short window.`,
      generateEvents: () => {
        const base = now();
        const count = merchantVelocityThreshold + 1;
        return Array.from({ length: count }).map((_, idx) => ({
          merchantId: 'merchant_velocity_hotspot',
          transactionId: `tx-velocity-${base}-${idx + 1}`,
          amount: 80 + idx * 5,
          status: 'APPROVED',
          cardHash: 'card_velocity_hotspot',
          timestamp: base + idx * 10_000
        }));
      }
    }
  ];
}

