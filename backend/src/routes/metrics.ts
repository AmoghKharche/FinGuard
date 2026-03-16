import { FastifyInstance } from "fastify";
import { metrics } from "../utils/metrics";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIstIso(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.toISOString();
}

export default async function metricsRoute(app: FastifyInstance) {

  app.get("/metrics", async () => {
    return {
      data: metrics.snapshot(),
      timestamp_ist: toIstIso(new Date())
    };
  });

}