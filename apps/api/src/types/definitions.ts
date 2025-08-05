// Cloudflare Workers環境の型定義
export type AppEnv = {
  Bindings: {
    GEMINI_API_KEY: string;
    GITHUB_APP_ID: string;
    GITHUB_SECRET_KEY: string;
    //DB: D1Database;
  };
};
