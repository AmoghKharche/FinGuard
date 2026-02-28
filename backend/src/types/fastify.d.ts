import "fastify";
import Redis from "ioredis";
import { Pool } from "pg";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
    pg: Pool;
  }
}