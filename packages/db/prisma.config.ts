import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const localEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export default defineConfig({
  schema: 'prisma/core.prisma',
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/lead_finder' },
});
