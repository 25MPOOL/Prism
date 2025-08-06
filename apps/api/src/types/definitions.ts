// GitHub関連の環境変数の型定義をインポート
import type { GithubEnv } from "./github";

// Cloudflare Workers環境の型定義
// Cloudflare Workers環境の型定義を拡張し、すべての環境変数をここに集約します。
export interface AppEnv extends GithubEnv {
  GEMINI_API_KEY: string;
  //DB: D1Database;
}
