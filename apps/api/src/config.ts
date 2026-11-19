import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const localEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(localEnv)) process.loadEnvFile(localEnv);

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
export function secret(name: string): string {
  const value = required(name);
  if (value.length < 32) throw new Error(`Server secret ${name} must have at least 32 characters`);
  return value;
}
export const config = {
  databaseUrl: required('DATABASE_URL'),
  proxyKey: secret('API_PROXY_KEY'),
  setupToken: secret('OWNER_SETUP_TOKEN'),
  origins: required('WEB_ORIGINS')
    .split(',')
    .map((x) => x.trim()),
  port: Number(process.env.PORT ?? 3001),
};
