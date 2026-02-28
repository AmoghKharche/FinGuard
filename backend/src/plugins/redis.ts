import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  });

  redis.on("connect", () => {
    fastify.log.info("Redis connected");
  });

  redis.on("error", (err) => {
    fastify.log.error(err);
  });

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin);