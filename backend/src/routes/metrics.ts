import { FastifyInstance } from "fastify";
import { metrics } from "../utils/metrics";

export default async function metricsRoute(app: FastifyInstance) {

  app.get("/metrics", async () => {
    return {
      data: metrics.snapshot(),
      timestamp: new Date().toISOString()
    };
  });

}