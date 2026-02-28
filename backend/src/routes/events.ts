import { FastifyPluginAsync } from "fastify";
import { STREAMS } from "../utils/constants";
import { randomUUID } from "crypto";

const eventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/events", async (request, reply) => {
    const body = request.body as any;

    const eventId = randomUUID();

    await fastify.redis.xadd(
      STREAMS.TRANSACTIONS,
      "*",
      "eventId",
      eventId,
      "merchantId",
      body.merchantId,
      "transactionId",
      body.transactionId,
      "amount",
      body.amount.toString(),
      "status",
      body.status,
      "cardHash",
      body.cardHash,
      "timestamp",
      body.timestamp.toString()
    );
    fastify.log.info(
        { eventId, transactionId: body.transactionId },
        "📥 Event accepted"
      );

    return reply.status(202).send({ accepted: true, eventId });
  });
};

export default eventsRoute;