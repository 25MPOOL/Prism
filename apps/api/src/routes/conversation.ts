import { Hono } from "hono";
// import { cors } from "hono/cors";
import { ConversationService } from "../services/conversationsService";
import type { AppEnv } from "../types/definitions";

const conversations = new Hono<AppEnv>();

// チャット用エンドポイント
conversations.post("/chat", async (c) => {
  // 処理中に何かエラーが起こったらcatchがキャッチ
  try {
    // リクエストからmessage, sessionIdを取り出す
    const { message, sessionId } = await c.req.json();

    const apiKey = c.env?.GEMINI_API_KEY;
    if (!apiKey) {
      return c.json({ error: "API key not found" }, 500);
    }

    const conversationService = new ConversationService(apiKey);
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

// ヘルスチェック用
conversations.get("/health", async (c) => {
  return c.json({ status: "ok", service: "conversations" });
});

export { conversations };
