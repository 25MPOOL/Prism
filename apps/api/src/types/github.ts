import { Hono } from "hono";

// 1. 環境変数の型を定義します。
interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

// 2. Honoのインスタンスに型を適用します。
const app = new Hono<{ Bindings: Env }>();

// GitHub OAuth認証のコールバックエンドポイント
app.get("/callback", async (c) => {
  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = c.env.GITHUB_CLIENT_SECRET;

  // GitHubから送られてくる認証コードとstateを取得
  const code = c.req.query("code");
  // const state = c.req.query("state");

  // ⚠️ 実際のアプリケーションでは、CSRF対策として
  // セッションに保存しておいたstateと一致するか検証するロジックが必要です。
  // const savedState = c.session.get('github_oauth_state');
  // if (state !== savedState) {
  //   return c.text('State mismatch!', 403);
  // }

  // codeが存在しない場合はエラーレスポンスを返す
  if (!code) {
    return c.text("No code provided", 400);
  }

  // ステップ3: 認証コードを使ってアクセストークンを交換する
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code: code,
    }),
  });

  const data = await response.json();
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;

  // アクセストークンが取得できなかった場合はエラーレスポンスを返す
  if (!accessToken) {
    return c.text("Failed to get access Token", 500);
  }

  // アクセストークンとリフレッシュトークンを次の処理に渡す
  // この段階で、ユーザーとトークンを紐付けてデータベースに保存する処理に進みます。
  console.log("Access TOken:", accessToken);
  console.log("Refresh Token:", refreshToken);

  // 認証成功のメッセージを返す（後ほどフロントエンドへのリダイレクトなどに変更）
  return c.text("Authentication successful!");
});

export default app;
