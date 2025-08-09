import { Hono } from "hono";
import {
  exchangeCodeForTokens,
  getGitHubUserProfile,
} from "../services/github/auth"; // getGitHubUserProfileをインポート
import { findOrCreateUser, saveGitHubTokens } from "../services/user"; // findOrCreateUser, saveGitHubTokensをインポート
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../../drizzle/schema";
import type { AppEnv } from "../types/definitions"; // AppEnvをインポート
import { getCookie, setCookie } from "hono/cookie";

// GitHub関連のルートを管理するためのHonoインスタンスを作成します。
// Bindingsの型としてAppEnv自体を使用します。
const githubRouter = new Hono<{
  Bindings: AppEnv;
  Variables: { db: DrizzleD1Database<typeof schema> };
}>();

// GitHub OAuth認証の開始エンドポイント
// ユーザーをGitHubの認証ページへリダイレクトします。
githubRouter.get("/oauth", async (c) => {
  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID;
  const GITHUB_REDIRECT_URI = c.env.GITHUB_REDIRECT_URI;

  // CSRF攻撃を防ぐための一意なstate文字列を生成
  const state = crypto.randomUUID();

  //  CSRF対策: stateをcookieに保存（10分）
  setCookie(c, "github_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 600,
  });

  // ⚠️ 注意: 実際のアプリケーションでは、このstateをセッションなどに保存し、
  // コールバック時に検証する必要があります。

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&state=${state}&scope=repo,read:org`;

  return c.redirect(githubAuthUrl);
});

// GitHub OAuth認証のコールバックエンドポイント
// GitHubからの認証コードを受け取り、アクセストークンを交換します。
githubRouter.get("/callback", async (c) => {
  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = c.env.GITHUB_CLIENT_SECRET;

  const code = c.req.query("code");
  const returnedState = c.req.query("state");
  const storedState = getCookie(c, "github_oauth_state");

  if (!code) return c.text("No code provided", 400);

  // CSRF対策: state検証
  if (!returnedState || !storedState || returnedState !== storedState) {
    return c.text("Invalid state parameter. Possible CSRF attack.", 400);
  }
  // 使い捨て: Cookie削除
  setCookie(c, "github_oauth_state", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  // 以下、トークン交換へ続行…

  // DBインスタンスをコンテキストから取得
  // AppContextを使わない場合、c.get()の戻り値はany型になるため、D1Database型にキャストします。
  const db = c.get("db");
  if (!db) {
    return c.text(
      "Database not initialized. Check your D1 binding in wrangler.jsonc or .env.",
      500,
    );
  }

  try {
    // 1. GitHubからアクセストークンを交換
    const tokens = await exchangeCodeForTokens(
      code,
      GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET,
    );
    if (!tokens || !tokens.access_token) {
      return c.text("Failed to get access token from GitHub.", 500);
    }

    // 2. アクセストークンを使ってGitHubユーザープロファイルを取得
    const userProfile = await getGitHubUserProfile(tokens.access_token);
    if (!userProfile) {
      return c.text("Failed to get GitHub user profile.", 500);
    }

    // 3. GitHubユーザーIDに基づいてPrism内部のユーザーを検索または新規作成
    const user = await findOrCreateUser(db, userProfile.id, userProfile.login);

    // 4. 取得したユーザーIDとトークンをデータベースに保存/更新
    await saveGitHubTokens(db, user.id, tokens);

    // GitHub OAuth成功時、user.idをprism_uidとして保存
    setCookie(c, "prism_uid", user.id, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    console.log("Authentication successful for user:", user.githubUsername);
    console.log("Access Token saved/updated for userId:", user.id);

    // 認証成功のHTMLレスポンス (テスト用)
    return c.html(`
      <html lang="ja">
        <head>
          <title>認証成功</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: 'Inter', sans-serif; }
          </style>
        </head>
        <body class="bg-gray-900 text-white min-h-screen flex items-center justify-center p-4">
          <div class="bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center rounded-xl">
            <h1 class="text-3xl font-bold mb-4 text-green-400">認証成功！</h1>
            <p class="text-lg mb-6 text-gray-300">GitHubアカウントとの連携が完了し、トークンが保存されました。</p>
            <div class="bg-gray-700 p-4 rounded-md text-left break-all text-sm mb-4">
              <h2 class="font-semibold mb-2 text-gray-400">認証済みユーザー:</h2>
              <p><strong>Prism User ID:</strong> ${user.id}</p>
              <p><strong>GitHub Username:</strong> ${user.githubUsername}</p>
              <p><strong>GitHub ID:</strong> ${user.githubId}</p>
            </div>
            <a href="/" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 transform hover:scale-105 inline-block">
              トップに戻る
            </a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return c.json(
      {
        error: "Authentication failed",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

export default githubRouter;
