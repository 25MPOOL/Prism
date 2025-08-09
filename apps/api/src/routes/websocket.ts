import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type {
  AppEnv,
  ChatMessageData,
  WebSocketMessage,
  WebSocketResponse,
} from "../types/definitions";
import { ConversationService } from "../services/conversationsService";

const websocket = new Hono<{ Bindings: AppEnv }>();

websocket.get("/connect", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  // もし合言葉が無ければ処理が中段
  if (upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  const userId = getCookie(c, "prism_uid"); // 接続時、prism_uid取得
  if (!userId) {
    return c.text("Unauthorized", 401);
  }

  const apiKey = c.env?.GEMINI_API_KEY;
  const database = c.env?.DB;
  if (!apiKey || !database) {
    return c.text("API key not found", 500);
  }

  // client用とserver用のトランシーバーを作る
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  const conversationService = new ConversationService(apiKey, database);

  // server側トランシーバーを起動
  server.accept();

  // サーバーの耳（何か受信したら常に実行される）
  server.addEventListener("message", async (event) => {
    try {
      const raw = event.data;
      let text: string;

      console.log("raw", raw);

      if (typeof raw === "string") {
        text = raw;
      } else if (raw instanceof ArrayBuffer) {
        text = new TextDecoder().decode(raw);
      } else if (ArrayBuffer.isView(raw)) {
        text = new TextDecoder().decode(raw.buffer);
      } else {
        sendError(server, "Unsupported message data type");
        return;
      }

      let message: WebSocketMessage;
      try {
        message = JSON.parse(text);
      } catch (_e) {
        sendError(server, "Invalid message, JSON parse error");
        return;
      }

      console.log("message", message);

      if (!message || typeof message.type !== "string") {
        sendError(server, "Invalid message, missing 'type'");
        return;
      }

      await handleWebSocketMessage(
        server,
        message,
        conversationService,
        userId,
      );
    } catch (error) {
      console.error("WebSocket message error:", error);
      sendError(server, "Invalid message, format");
    }
  });

  // ここで専用回線に切り替わる
  return new Response(null, {
    status: 101, // 「プロトコルを切り替えます」という合図
    webSocket: client, // client用のトランシーバーを渡す
  });
});

async function handleWebSocketMessage(
  webSocket: WebSocket,
  message: WebSocketMessage,
  conversationService: ConversationService,
  userId: string,
) {
  switch (message.type) {
    case "chat": {
      const d = message.data as unknown;
      if (!isChatMessageData(d)) {
        sendError(webSocket, "Invalid chat payload");
        return;
      }
      await handleChat(webSocket, d, message.messageId, conversationService);
      break;
    }
    case "session_create":
      await handleSessionCreate(
        webSocket,
        message.messageId,
        conversationService,
        userId,
      );
      break;
    case "ping":
      handlePing(webSocket, message.messageId);
      break;
    default:
      sendError(webSocket, `Unknown message type: ${message.type}`);
  }
}

async function handleChat(
  webSocket: WebSocket,
  data: ChatMessageData,
  messageId: string | undefined,
  conversationService: ConversationService,
) {
  const response = await conversationService.processMessage(
    data.sessionId,
    data.message,
  );

  const wsResponse: WebSocketResponse = {
    type: "chat_response",
    data: { message: response },
    messageId,
  };

  webSocket.send(JSON.stringify(wsResponse));
}

async function handleSessionCreate(
  webSocket: WebSocket,
  messageId: string | undefined,
  conversationService: ConversationService,
  userId: string,
) {
  const session = await conversationService.createSession(userId);

  const wsResponse: WebSocketResponse = {
    type: "session_created",
    data: { session },
    messageId,
  };

  webSocket.send(JSON.stringify(wsResponse));
}

function handlePing(webSocket: WebSocket, messageId: string | undefined) {
  const wsResponse: WebSocketResponse = {
    type: "pong",
    data: { timestamp: new Date().toISOString() },
    messageId,
  };

  webSocket.send(JSON.stringify(wsResponse));
}

function sendError(webSocket: WebSocket, error: string) {
  const wsResponse: WebSocketResponse = {
    type: "error",
    data: { error },
  };

  webSocket.send(JSON.stringify(wsResponse));
}

function isChatMessageData(v: unknown): v is ChatMessageData {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as { sessionId?: unknown; message?: unknown };
  return typeof obj.sessionId === "string" && typeof obj.message === "string";
}

export { websocket };
