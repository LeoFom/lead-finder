import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

export function createDatabase(url: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: 5, connectionTimeoutMillis: 10000 }),
  });
}
export { Prisma, PrismaClient } from './generated/client.js';
