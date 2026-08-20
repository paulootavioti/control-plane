import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var controlPlanePrisma: PrismaClient | undefined;
}

export const prisma = global.controlPlanePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.controlPlanePrisma = prisma;
}
