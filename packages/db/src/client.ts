import { PrismaClient } from "../generated/prisma/index";

// Module-level singleton, cached on `globalThis` in dev so Next's hot
// reload doesn't open a fresh connection pool on every file save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
