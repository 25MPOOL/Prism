import { defineConfig } from "drizzle-kit";

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
