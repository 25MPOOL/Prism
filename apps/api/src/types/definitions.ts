/// <reference path="../../worker-configuration.d.ts" />

// Cloudflare Workers環境の型定義
export type AppEnv = {
  Bindings: {
    GEMINI_API_KEY: string;
    GITHUB_APP_ID: string;
    GITHUB_SECRET_KEY: string;
    DB: D1Database;
  };
};

/*
-----既存のHTTP API用型定義-----
*/

// Message内容の型
export interface ConversationMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

export interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  phase: "idea" | "requirements" | "tasks";
}

/*
-----Websocket Client => Server-----
*/

//Websocket用のMessage型
export interface ChatMessageData {
  message: string;
  sessionId: string;
}

export interface PingData {
  timestamp?: string;
}

//Websocket送信Message型
export interface WebSocketMessage {
  type: "chat" | "session_create" | "ping";
  data: ChatMessageData | PingData | null;
  messageId?: string;
}

/*
-----Websocket Server => Client-----
*/

//Websocket応答データ型
export interface ChatResponseData {
  message: ConversationMessage;
}

export interface SessionCreatedData {
  session: ConversationSession;
}

export interface ErrorData {
  error: string;
  details?: string;
  code?: "INVALID_SESSION" | "AUTH_ERROR" | "INTERNAL_ERROR";
}

export interface PongData {
  timestamp: string;
}

// Websocket応答Message型
export interface WebSocketResponse {
  type: "chat_response" | "session_created" | "error" | "pong" | "processing";
  data: ChatResponseData | SessionCreatedData | ErrorData | PongData | null;
  messageId?: string;
}
