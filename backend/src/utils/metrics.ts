type DecisionType = "APPROVED" | "REVIEW" | "DECLINED";

class MetricsRegistry {

  transactionsProcessed = 0;
  transactionsApproved = 0;
  transactionsReview = 0;
  transactionsDeclined = 0;

  fraudAlertsTotal = 0;
  fraudAlertsByRule: Record<string, number> = {};

  retryTotal = 0;
  dlqTotal = 0;
  workerErrors = 0;

  incrementTransaction(decision: DecisionType) {
    this.transactionsProcessed++;

    if (decision === "APPROVED") this.transactionsApproved++;
    if (decision === "REVIEW") this.transactionsReview++;
    if (decision === "DECLINED") this.transactionsDeclined++;
  }

  incrementFraud(ruleType: string) {
    this.fraudAlertsTotal++;
    this.fraudAlertsByRule[ruleType] =
      (this.fraudAlertsByRule[ruleType] || 0) + 1;
  }

  incrementRetry() {
    this.retryTotal++;
  }

  incrementDLQ() {
    this.dlqTotal++;
  }

  incrementWorkerError() {
    this.workerErrors++;
  }

  snapshot() {
    return {
      transactionsProcessed: this.transactionsProcessed,
      transactionsApproved: this.transactionsApproved,
      transactionsReview: this.transactionsReview,
      transactionsDeclined: this.transactionsDeclined,
      fraudAlertsTotal: this.fraudAlertsTotal,
      fraudAlertsByRule: this.fraudAlertsByRule,
      retryTotal: this.retryTotal,
      dlqTotal: this.dlqTotal,
      workerErrors: this.workerErrors
    };
  }
}

export const metrics = new MetricsRegistry();