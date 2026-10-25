import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { createApi } from "./app.js";

const { server, io } = createApi();
let shuttingDown = false;

server.on("error", (error) => {
  console.error("API server failed:", error);
  process.exitCode = 1;
});

server.listen(config.PORT, () => {
  console.info(`NamsaMart API listening on port ${config.PORT}`);
});

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; shutting down gracefully.`);
  const timeout = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    server.closeAllConnections();
    process.exitCode = 1;
  }, 10_000);
  timeout.unref();

  try {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await prisma.$disconnect();
  } catch (error) {
    console.error("API shutdown failed:", error);
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
