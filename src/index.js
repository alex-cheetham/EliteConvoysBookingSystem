require("dotenv").config();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});


const { startBot } = require("./bot/client");
const { startWeb } = require("./web/server");
const { prisma } = require("./db/prisma");
const { logger } = require("./logger");

async function main() {
  logger.info("Starting Elite Convoys...");

  // Ensure Prisma client can connect
  await prisma.$connect();
  logger.info("Database connected.");

  // Start bot & web
  await startBot();
  await startWeb();

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function shutdown() {
  logger.info("Shutting down...");
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
