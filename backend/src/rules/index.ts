import { velocityRule } from "./velocity.rule";
import { FraudRule } from "./types";
import { highAmountRule } from "./highAmount.rule";
import { rapidFailureRule } from "./rapidFailure.rule";

export const fraudRules: FraudRule[] = [
  velocityRule,
  highAmountRule,
  rapidFailureRule

];