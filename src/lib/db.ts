import { PrismaClient } from "@prisma/client";
import { log } from "../Utility/common";
import { COLORS } from "../constant";
import logger from "./logger";

const prisma = new PrismaClient();

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
