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
  // スキーマファイルの場所
  schema: "./drizzle/schema.ts",
  // マイグレーションファイルの出力先
  out: "./drizzle/migrations",
  dialect: "sqlite",
  //driver: 'd1',
  // dbCredentials: {
  //     // wranglerの設定ファイルパス
  //     wranglerConfigPath: './wrangler.jsonc',
  //     dbName: 'dummy',
  // },
  verbose: true,
  strict: true,
});
