import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

const localEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: env('DATABASE_URL') },
});
