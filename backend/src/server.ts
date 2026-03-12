import { buildApp } from "./app";
import { startTransactionWorker } from "./workers/transactionWorker";

const start = async () => {
  const app = await buildApp();

  await app.listen({ port: Number(process.env.PORT) || 4000 });
  startTransactionWorker(app);

  app.log.info({ port: Number(process.env.PORT) || 4000 }, "Server started");
};

start();