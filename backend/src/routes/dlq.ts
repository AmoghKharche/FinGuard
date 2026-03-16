import { FastifyInstance } from "fastify";

const DLQ_STREAM = "transactions_dlq";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIstIso(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.toISOString();
}

export default async function dlqRoute(app: FastifyInstance) {

  app.get("/dlq", async (request, reply) => {
    const query = request.query as any;
    const limit = Number(query.limit) || 20;

    const result = await app.redis.xrevrange(
      DLQ_STREAM,
      "+",
      "-",
      "COUNT",
      limit
    );

    const data = result.map(([id, fields]: any) => {
      const obj: Record<string, string> = {};

      for (let i = 0; i < fields.length; i += 2) {
        obj[fields[i]] = fields[i + 1];
      }

      let parsedPayload: any = null;

      try {
        parsedPayload = JSON.parse(obj.payload);
      } catch (e) {
        parsedPayload = obj.payload;
      }

      if (parsedPayload && typeof parsedPayload.failedAt === "string") {
        const d = new Date(parsedPayload.failedAt);
        if (!isNaN(d.getTime())) {
          parsedPayload.failedAtIst = toIstIso(d);
        }
      }

      return {
        id,
        ...parsedPayload
      };
    });

    return {
      data,
      count: data.length
    };
  });

}