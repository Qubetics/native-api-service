import { PrismaClient } from "@prisma/client";
import { log } from "../Utility/common";
import { COLORS } from "../constant";
import logger from "./logger";

const isDev = process.env.NODE_ENV === "development";

const prisma = new PrismaClient({
  log: isDev ? ["query", "info", "warn", "error"] : ["warn", "error"],
  errorFormat: "pretty",
  datasourceUrl: process.env.DATABASE_URL + "&connection_limit=20&pool_timeout=30",
});

// Log message when the Prisma Client is connected to the database
prisma
  .$connect()
  .then(() => {
    log("Database connected ", COLORS.yellow, true, COLORS.green);
  })
  .catch((error) => {
    logger.error("Error connecting to database:", error);
  });

export default prisma;
