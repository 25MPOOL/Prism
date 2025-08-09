import { Hono } from "hono";
// import { cors } from "hono/cors";
import { ConversationService } from "../services/conversationsService";
import type { AppEnv } from "../types/definitions";

const conversations = new Hono<{
  Bindings: AppEnv;
  Variables: { userId: string | null };
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

conversations.get("/sessions", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const svc = new ConversationService(c.env.GEMINI_API_KEY ?? "", c.env.DB);
  const sessions = await svc.listSessionsByUser(userId, { days: 7, limit: 50 });
  return c.json({ success: true, data: { sessions } });
});

// ヘルスチェック用
conversations.get("/health", async (c) => {
  return c.json({ status: "ok", service: "conversations" });
});

export { conversations };
