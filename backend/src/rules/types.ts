import { FastifyInstance } from "fastify";

export interface FraudRule {
  ruleType: string;

  evaluate(
    app: FastifyInstance,
    client: any,
    event: any
  ): Promise<RuleResult>;
}

export interface RuleResult {
    ruleType: string;
    triggered: boolean;
    severity: number;
  }