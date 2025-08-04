import { Hono } from "hono";

// 1. 環境変数の型を定義します。
// ここに`GITHUB_CLIENT_ID`と`GITHUB_REDIRECT_URI`が
// 存在することをTypeScriptに伝えます。
interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_REDIRECT_URI: string;
}

// 2. Honoのインスタンスを作成する際に、ジェネリクスを使って
// `env`の型として定義した`Env`インターフェースを渡します。
const app = new Hono<{ Bindings: Env }>();

// GitHub OAuth認証の開始エンドポイント
app.get("/login/github", async (c) => {
  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID;
  const GITHUB_REDIRECT_URI = c.env.GITHUB_REDIRECT_URI;

  // CSRF対策のため、一意なstate文字列を生成
  const state = Math.random().toString(36).substring(2);

  // ⚠️ 注意: 実際のアプリケーションでは、このstateをセッションなどに保存し、
  // コールバック時に検証する必要があります。

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&state=${state}&scope=repo,read:org`;

  // 生成したURLにユーザーをリダイレクトします。
  return c.redirect(githubAuthUrl);
});

export default app;
