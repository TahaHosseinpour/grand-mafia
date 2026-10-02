import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 reads its settings from here, not from schema.prisma.
 *
 * Environment loading is explicit in Prisma 7. `process.loadEnvFile` is Node's
 * built-in .env reader (no dotenv dependency); in production the variables
 * come from the process environment and there is no file.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file: the environment is provided by the host.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --import ./scripts/register-hooks.mjs prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/secret_hitler',
  },
});
