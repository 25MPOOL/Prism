import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../drizzle/schema";
import { ConversationService } from "../services/conversationsService";
import type { AppEnv } from "../types/definitions";
import { revokeGitHubToken } from "../services/github/auth";

const conversations = new Hono<{
  Bindings: AppEnv;
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    userId: string | null;
  };
}>();

// チャット用エンドポイント
conversations.post("/chat", async (c) => {
  // 処理中に何かエラーが起こったらcatchがキャッチ
  try {
    // リクエストからmessage, sessionIdを取り出す
    const { message, sessionId } = await c.req.json();

    const apiKey = c.env?.GEMINI_API_KEY;
    const database = c.env?.DB;
    if (!apiKey || !database) {
      return c.json({ error: "API key or database is not found" }, 500);
    }

    const conversationService = new ConversationService(apiKey, database);
    const response = await conversationService.processMessage(
      sessionId || "test-session",
      message,
    );

    return c.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return c.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

// チャット履歴一覧表示
conversations.get("/sessions", async (c) => {
  const userId = c.get("userId"); // Cookieでユーザー識別
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const svc = new ConversationService(c.env.GEMINI_API_KEY ?? "", c.env.DB);
  const sessions = await svc.listSessionsByUser(userId, { days: 7, limit: 50 });
  return c.json({ success: true, data: { sessions } });
});

conversations.get("/sessions/:sessionId/messages", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { sessionId } = c.req.param();
  const svc = new ConversationService(c.env.GEMINI_API_KEY ?? "", c.env.DB);

  // 所有者チェック
  const owner = await svc.getSessionOwner(sessionId);
  if (owner !== userId) return c.json({ error: "Forbidden" }, 403);

  const session = await svc.getSessionData(sessionId);
  return c.json({ success: true, data: session });
});

conversations.get("/:sessionId/issues", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { sessionId } = c.req.param();
  const svc = new ConversationService(c.env.GEMINI_API_KEY ?? "", c.env.DB);

  // 所有者チェック
  const owner = await svc.getSessionOwner(sessionId);
  if (owner !== userId) return c.json({ error: "Forbidden" }, 403);

  try {
    const issues = await svc.generateTasksFromSession(sessionId);
    return c.json({ success: true, issues });
  } catch (error) {
    console.error("Failed to generate issues:", error);
    return c.json(
      {
        error: "Failed to generate issues",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

conversations.post("/auth/logout", async (c) => {
  const userId = c.get("userId");
  const GITHUB_CLIENT_ID = c.env.GITHUB_CLIENT_ID;
  const GITHUB_CLIENT_SECRET = c.env.GITHUB_CLIENT_SECRET;

  // Cookie削除
  setCookie(c, "prism_uid", "", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: 0,
  });
  setCookie(c, "ext_redirect", "", { path: "/", maxAge: 0 });
  setCookie(c, "github_oauth_state", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  // DBからユーザーデータ削除する前に、GitHubの連携を解除する
  if (userId) {
    const db = c.get("db");
    if (db) {
      try {
        // ユーザーのGitHubトークンを取得
        const tokenRecord = await db
          .select()
          .from(schema.githubTokens)
          .where(eq(schema.githubTokens.userId, userId))
          .get();

        if (
          tokenRecord?.accessToken &&
          GITHUB_CLIENT_ID &&
          GITHUB_CLIENT_SECRET
        ) {
          // GitHubトークンを無効化
          await revokeGitHubToken(
            tokenRecord.accessToken,
            GITHUB_CLIENT_ID,
            GITHUB_CLIENT_SECRET,
          );
        }

        // DBからユーザーデータ削除（cascadeで関連テーブルも削除）
        await db.delete(schema.users).where(eq(schema.users.id, userId));
        console.log(`User ${userId} and all related data deleted`);
      } catch (error) {
        console.error("Failed to delete user data:", error);
        // エラーでもCookie削除は成功として扱う
      }
    }
  }

  return c.json({ success: true });
});

// ヘルスチェック用
conversations.get("/health", async (c) => {
  return c.json({ status: "ok", service: "conversations" });
});

export { conversations };
