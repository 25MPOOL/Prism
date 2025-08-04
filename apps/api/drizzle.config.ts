import { defineConfig } from "drizzle-kit";
import "dotenv/config";

function getEnvVariable(name: string): string {
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
  dbCredentials: {
    accountId: getEnvVariable("CLOUDFLARE_ACCOUNT_ID"),
    databaseId: getEnvVariable("CLOUDFLARE_DATABASE_ID"),
    token: getEnvVariable("CLOUDFLARE_API_TOKEN"),
  },
  verbose: true,
  strict: true,
});
