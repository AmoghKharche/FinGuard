import { FastifyPluginAsync } from "fastify";

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => {
    await fastify.redis.ping();
    await fastify.pg.query("SELECT 1");

    return {
      status: "ok",
    };
  });
};

export default healthRoute;