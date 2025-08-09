import { create } from "zustand";
import { WebSocketManager } from "@/lib/websocket-manager";

interface UiMessage {
  id: string;
  role: "user" | "ai";
  content: string;
}

interface ChatState {
  messages: UiMessage[];
  isConnected: boolean;
  isLoading: boolean;
  sessionId: string | null;
  error: string | null;
  _manager: WebSocketManager<ServerMessage, ClientMessage> | null;
  pendingQueue: string[];
  connect: () => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  newChat: () => void;
  reset: () => void;
  loadSession: (id: string) => Promise<void>;
}

type ServerMessage =
  | { type: "session_created"; data: { session: { id: string } } }
  | {
      type: "chat_response";
      data: {
        message: UiMessage;
      };
    }
  | { type: "error"; data: { error?: string } }
  | { type: "pong"; data: { timestamp: string } };

type ClientMessage =
  | {
      type: "session_create";
      data: null;
    }
  | {
      type: "chat";
      data: { sessionId: string; message: string };
    };

const WS_URL = "wss://prism-api.kaitomichigan22.workers.dev/ws/connect";

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isConnected: false,
  isLoading: false,
  sessionId: null,
  error: null,
  _manager: null,
  pendingQueue: [],

  connect: () => {
    if (get()._manager) return;

    const manager = new WebSocketManager<ServerMessage, ClientMessage>(WS_URL, {
      onOpen: (m) => {
        set({ isConnected: true, isLoading: false });
        m.send({ type: "session_create", data: null });
      },
      onMessage: (data) => {
        switch (data.type) {
          case "session_created": {
            set({ sessionId: data.data.session.id });
            const { _manager, pendingQueue } = get();
            if (_manager && pendingQueue.length) {
              for (const content of pendingQueue) {
                _manager.send({
                  type: "chat",
                  data: { sessionId: data.data.session.id, message: content },
                });
              }
              set({ pendingQueue: [] });
            }
            break;
          }
          case "chat_response": {
            const m = data.data.message;
            set((s) => ({
              isLoading: false,
              messages: [
                ...s.messages,
                { id: m.id, role: m.role, content: m.content },
              ],
            }));
            break;
          }
          case "error": {
            console.error("WS error:", data.data?.error);
            set({
              isLoading: false,
              error: data.data?.error || "Unknown error",
            });
            break;
          }
          case "pong": {
            // pong受信時のロジック (例: 最終受信時刻の更新など)
            break;
          }
        }
      },
      onError: () => {
        set({
          isConnected: false,
          isLoading: false,
          error: "WebSocket connection failed.",
        });
      },
      onClose: () => {
        set({ isConnected: false, sessionId: null, _manager: null });
      },
    });

    set({ _manager: manager, isLoading: true, error: null });
    manager.connect();
  },

  disconnect: () => {
    get()._manager?.disconnect();
  },

  sendMessage: (content: string) => {
    const { _manager, sessionId, connect } = get();

    if (!_manager) {
      connect();
    }
    if (!sessionId) {
      set((s) => ({
        messages: [
          ...s.messages,
          { id: crypto.randomUUID(), role: "user", content },
        ],
        isLoading: true,
        error: null,
        pendingQueue: [...s.pendingQueue, content],
      }));
      return;
    }

    set((s) => ({
      messages: [
        ...s.messages,
        { id: crypto.randomUUID(), role: "user", content },
      ],
      isLoading: true,
      error: null,
    }));

    _manager?.send({ type: "chat", data: { sessionId, message: content } });
  },

  // 履歴から既存セッションをロードして再開
  loadSession: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const res = await fetch(
        "https://prism-api.kaitomichigan22.workers.dev/sessions/" +
          id +
          "/messages",
        { credentials: "include" },
      );
      const { data } = await res.json();
      const msgs = (
        data.messages as { id: string; role: "user" | "ai"; content: string }[]
      ).map((m) => ({ id: m.id, role: m.role, content: m.content }));
      set({ sessionId: id, messages: msgs, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false, error: "Failed to load session" });
    }
  },

  newChat: () => {
    set({ messages: [], isLoading: false, error: null });
    const manager = get()._manager;
    if (manager && manager.getReadyState() === WebSocket.OPEN) {
      manager.send({ type: "session_create", data: null });
    } else {
      get().connect();
    }
  },

  reset: () => {
    get().disconnect();
    set({ messages: [], isLoading: false, error: null });
  },
}));
