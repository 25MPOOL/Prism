import { defineConfig } from "drizzle-kit";
import "dotenv/config";

function _getEnvVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: _getEnvVariable("CLOUDFLARE_ACCOUNT_ID"),
    databaseId: _getEnvVariable("CLOUDFLARE_DATABASE_ID"),
    token: _getEnvVariable("CLOUDFLARE_API_TOKEN"),
  },
  verbose: true,
  strict: true,
});
