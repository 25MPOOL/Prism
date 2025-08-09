import { Hono } from "hono";
import {
  exchangeCodeForTokens,
  getGitHubUserProfile,
} from "../services/github/auth"; // getGitHubUserProfileをインポート
import {
  findOrCreateUser,
  saveGitHubTokens,
  getValidGitHubAccessToken,
} from "../services/user"; // findOrCreateUser, saveGitHubTokensをインポート
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

  // 拡張機能から渡されたリダイレクト先URLを取得しCookieに保存（10分）
  const extRedirect = c.req.query("extRedirect");
  if (extRedirect) {
    setCookie(c, "ext_redirect", extRedirect, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 600,
    });
  }

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

  // github_oauth_state削除
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
      sameSite: "None", // Lax から Noneに変更（拡張→APIのクロスサイト送信を許可）
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    console.log("Authentication successful for user:", user.githubUsername);
    console.log("Access Token saved/updated for userId:", user.id);

    // 拡張リダイレクト先が保存されていれば、そのURLへ成功フラグを付けてリダイレクト
    const extRedirect = getCookie(c, "ext_redirect");
    if (extRedirect) {
      // Cookieを削除
      setCookie(c, "ext_redirect", "", { maxAge: 0, path: "/" });
      return c.redirect(`${extRedirect}#success=1`);
    }

    // 拡張側からの要求でなければ、簡易成功ページを返す
    return c.html("<h1>Authentication Successful</h1>");
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

// 新規追加: トークン取得とリフレッシュのテストエンドポイント
githubRouter.get("/test-token-refresh", async (c) => {
  const db = c.get("db");
  if (!db) return c.text("Database not initialized.", 500);

  const userId = c.req.query("userId"); // テストしたいユーザーのPrism User IDをクエリパラメータで渡す
  if (!userId) return c.text("User ID is required for testing.", 400);

  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = c.env.GITHUB_CLIENT_SECRET;

  try {
    const validAccessToken = await getValidGitHubAccessToken(
      db,
      userId,
      GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET,
    );

    if (validAccessToken) {
      // 取得したトークンを使ってGitHub APIを呼び出してみる (例: /user API)
      const userProfile = await getGitHubUserProfile(validAccessToken);
      return c.json({
        message: "Successfully got valid access token and user profile.",
        accessToken: validAccessToken,
        userProfile: userProfile,
      });
    } else {
      return c.json(
        {
          message:
            "Failed to get a valid access token. User may need to re-authenticate.",
        },
        401,
      );
    }
  } catch (error) {
    console.error("Test token refresh endpoint error:", error);
    return c.json({ error: "Internal server error during token test." }, 500);
  }
});

// Chrome拡張（chromiumapp.org）向け: 拡張が受け取ったcodeをAPIに渡してトークン交換するエンドポイント
// 拡張側で chrome.identity.launchWebAuthFlow により https://<EXT_ID>.chromiumapp.org/ にリダイレクトを受け、
// そのURLに含まれる ?code=...&state=... をここにPOSTして処理します。
githubRouter.post("/exchange", async (c) => {
  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = c.env.GITHUB_CLIENT_SECRET;

  let body: { code?: string; state?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const code = body.code;
  // state は将来的に検証する（現在は拡張フローの都合でサーバー側保持がないため任意）

  if (!code) {
    return c.json({ error: "code is required" }, 400);
  }

  // DBインスタンス取得
  const db = c.get("db");
  if (!db) {
    return c.text(
      "Database not initialized. Check your D1 binding in wrangler.jsonc or .env.",
      500,
    );
  }

  try {
    // 1. トークン交換
    const tokens = await exchangeCodeForTokens(
      code,
      GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET,
    );
    if (!tokens || !tokens.access_token) {
      return c.json({ error: "Failed to get access token from GitHub." }, 500);
    }

    // 2. GitHubユーザープロファイル取得
    const userProfile = await getGitHubUserProfile(tokens.access_token);
    if (!userProfile) {
      return c.json({ error: "Failed to get GitHub user profile." }, 500);
    }

    // 3. Prism内部ユーザーUpsert
    const user = await findOrCreateUser(db, userProfile.id, userProfile.login);

    // 4. トークン保存
    await saveGitHubTokens(db, user.id, tokens);

    // 拡張機能側でもcookieを実装
    setCookie(c, "prism_uid", user.id, {
      httpOnly: true,
      secure: true,
      sameSite: "None", // Lax から Noneに変更（拡張→APIのクロスサイト送信を許可）
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return c.json({
      success: true,
      message: "Authentication successful",
      user: {
        id: user.id,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
      },
    });
  } catch (error) {
    console.error("GitHub OAuth exchange error:", error);
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
