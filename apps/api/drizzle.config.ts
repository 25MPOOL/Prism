import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // スキーマファイルの場所
  schema: "./drizzle/schema.ts",
  // マイグレーションファイルの出力先
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./.wrangler/state/v3/d1/miniflare-D1DatabaseObject/162a2a05-5259-4671-897a-966d92b9cf5c.sqlite",
  },
  verbose: true,
  strict: true,
});
