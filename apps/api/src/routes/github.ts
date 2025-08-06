import { Hono } from "hono";
import { exchangeCodeForTokens } from "../services/github/auth";
import type { AppEnv } from "../types/definitions"; // AppEnvをインポート

// GitHub関連のルートを管理するためのHonoインスタンスを作成します。
// 修正: Bindingsの型としてAppEnv自体を使用します。
// これにより、c.envがAppEnvのプロパティ（GITHUB_CLIENT_IDなど）を直接持つことを示します。
const githubRouter = new Hono<{ Bindings: AppEnv }>();

// GitHub OAuth認証の開始エンドポイント
// ユーザーをGitHubの認証ページへリダイレクトします。
githubRouter.get("/oauth", async (c) => {
  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID; // c.envがAppEnv型を持つため、エラーが解消
  const GITHUB_REDIRECT_URI = c.env.GITHUB_REDIRECT_URI;

  // CSRF攻撃を防ぐための一意なstate文字列を生成
  const state = Math.random().toString(36).substring(2);

  // ⚠️ 注意: 実際のアプリケーションでは、このstateをセッションなどに保存し、
  // コールバック時に検証する必要があります。

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&state=${state}&scope=repo,read:org`;

  return c.redirect(githubAuthUrl);
});

// GitHub OAuth認証のコールバックエンドポイント
// GitHubからの認証コードを受け取り、アクセストークンを交換します。
githubRouter.get("/callback", async (c) => {
  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID; // c.envがAppEnv型を持つため、エラーが解消
  const GITHUB_CLIENT_SECRET = c.env.GITHUB_CLIENT_SECRET;

  const code = c.req.query("code");
  const _state = c.req.query("state"); // stateはCSRF対策に必要

  // ⚠️ 実際のアプリケーションでは、CSRF対策のstate検証が必要です。

  if (!code) {
    return c.text("No code provided", 400);
  }

  // サービス層の関数を呼び出してアクセストークンを交換
  const tokens = await exchangeCodeForTokens(
    code,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
  );

  if (!tokens || !tokens.access_token) {
    return c.text("Failed to get access token", 500);
  }

  console.log("Access Token:", tokens.access_token);
  console.log("Refresh Token:", tokens.refresh_token || "N/A");

  // 認証成功のHTMLレスポンス
  return c.html(`
    <html lang="ja">
      <head>
        <title>認証成功</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-900 text-white min-h-screen flex items-center justify-center p-4">
        <div class="bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 class="text-3xl font-bold mb-4 text-green-400">認証成功！</h1>
          <p class="text-lg mb-6">アクセストークンの取得に成功しました。</p>
          <div class="bg-gray-700 p-4 rounded-md text-left break-all text-sm mb-4">
            <h2 class="font-semibold mb-2 text-gray-400">取得したトークン（デバッグ用）:</h2>
            <p><strong>Access Token:</strong> ${tokens.access_token}</p>
            <p><strong>Refresh Token:</strong> ${tokens.refresh_token || "N/A"}</p>
          </div>
          <a href="/" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            トップに戻る
          </a>
        </div>
      </body>
    </html>
  `);
});

export default githubRouter;
