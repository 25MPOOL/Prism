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
  const abortController = new AbortController();
  let closed = false;
  const onClose = () => {
    closed = true;
    try {
      abortController.abort("ws closed");
    } catch {}
  };
  webSocket.addEventListener("close", onClose);
  webSocket.addEventListener("error", onClose);

  const hardTimeout = setTimeout(() => {
    try {
      abortController.abort("stream timeout");
    } catch {}
  }, 60_000);

  try {
    // 1文字ドリッパー（供給は随時append、送信は一定間隔で1文字）
    const dripper = createDripper(webSocket, messageId);

    // 真のストリーミング: GeminiのSSEを受け取りつつドリッパーに供給
    const streamed = await conversationService.processMessageStream(
      data.sessionId,
      data.message,
      async (delta) => {
        if (closed) return;
        dripper.append(delta);
      },
      {
        signal: abortController.signal as unknown as AbortSignal,
        idleMs: 15000,
      },
    );

    // 送信完了まで待つ
    await dripper.finish();

    if (!closed) {
      const wsResponse: WebSocketResponse = {
        type: "chat_response",
        data: { message: streamed },
        messageId,
      };
      webSocket.send(JSON.stringify(wsResponse));
    }
  } catch (err) {
    if (!closed) {
      const msg = (err as Error)?.message ?? "stream failed";
      const wsResponse: WebSocketResponse = msg.includes(
        "No response from Gemini API (stream)",
      )
        ? {
            type: "processing",
            data: { delta: "" },
            messageId,
          }
        : {
            type: "error",
            data: { error: msg },
            messageId,
          };
      try {
        webSocket.send(JSON.stringify(wsResponse));
      } catch {}
    }
  } finally {
    clearTimeout(hardTimeout);
    webSocket.removeEventListener("close", onClose);
    webSocket.removeEventListener("error", onClose);
  }
}

function createDripper(webSocket: WebSocket, messageId?: string) {
  let buffer = "";
  let done = false;
  let resolveDone: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const interval = setInterval(() => {
    if (buffer.length > 0) {
      const ch = buffer[0];
      buffer = buffer.slice(1);
      const streaming: WebSocketResponse = {
        type: "processing",
        data: { delta: ch },
        messageId,
      };
      try {
        webSocket.send(JSON.stringify(streaming));
      } catch {}
      return;
    }
    if (done) {
      clearInterval(interval);
      resolveDone?.();
    }
  }, 20);

  return {
    append(delta: string) {
      buffer += delta;
    },
    async finish() {
      done = true;
      await promise;
    },
  };
}

// Note: sleep is no longer used; keep for potential future tweaks

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
