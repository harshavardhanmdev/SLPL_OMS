import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const createClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

declare global {
  var prismaGlobal: undefined | ReturnType<typeof createClient>;
}

export const db = globalThis.prismaGlobal ?? createClient();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = db;
