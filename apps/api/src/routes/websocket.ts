import { Hono } from "hono";
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

  const apiKey = c.env?.GEMINI_API_KEY;
  if (!apiKey) {
    return c.text("API key not found", 500);
  }

  // client用とserver用のトランシーバーを作る
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  const conversationService = new ConversationService(apiKey);

  // server側トランシーバーの起動
  server.accept();

  // サーバーの耳（何か受信したら常に実行される）
  server.addEventListener("message", async (event) => {
    try {
      // 受信の内容(event)を解読
      const message: WebSocketMessage = JSON.parse(event.data as string);
      // その受信をそれぞれの役目にまかせる
      await handleWebSocketMessage(server, message, conversationService);
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
) {
  switch (message.type) {
    case "chat":
      await handleChat(
        webSocket,
        message.data as ChatMessageData,
        message.messageId,
        conversationService,
      );
      break;
    case "session_create":
      await handleSessionCreate(
        webSocket,
        message.messageId,
        conversationService,
      );
      break;
    case "ping":
      handlePing(webSocket, message.messageId);
      break;
    default:
      sendError(webSocket, `Unknown message type: ${(message as any).type}`);
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
) {
  const session = await conversationService.createSession();

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

export { websocket };
