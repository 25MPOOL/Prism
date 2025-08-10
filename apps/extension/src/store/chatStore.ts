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
  _streamBuffer: string;
  _streamId: string | null;
  _streamIntervalId: number | null;
  _ensureStreamTicker: () => void;
  typewriter?: { charsPerTick: number; tickMs: number };
  setTypewriter?: (
    opts: Partial<{ charsPerTick: number; tickMs: number }>,
  ) => void;
  _pendingFinal?: UiMessage | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  newChat: () => void;
  reset: () => void;
  loadSession: (id: string) => Promise<void>;
}

type ServerMessage =
  | {
      type: "session_created";
      data: { session: { id: string } };
      messageId?: string;
    }
  | {
      type: "chat_response";
      data: {
        message: UiMessage;
      };
      messageId?: string;
    }
  | { type: "processing"; data: { delta: string }; messageId?: string }
  | { type: "error"; data: { error?: string }; messageId?: string }
  | { type: "pong"; data: { timestamp: string }; messageId?: string };

type ClientMessage =
  | {
      type: "session_create";
      data: null;
      messageId?: string;
    }
  | {
      type: "chat";
      data: { sessionId: string; message: string };
      messageId: string;
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
  _streamBuffer: "",
  _streamId: null,
  _streamIntervalId: null,
  _pendingFinal: null,
  _ensureStreamTicker: () => {
    const state = get();
    if (state._streamIntervalId !== null) return;
    const charsPerTick = get().typewriter?.charsPerTick ?? 1;
    const tickMs = get().typewriter?.tickMs ?? 180;
    const interval = setInterval(
      () => {
        const s = get();
        if (!s._streamId) {
          clearInterval(interval as unknown as number);
          set({ _streamIntervalId: null });
          return;
        }
        if (!s._streamBuffer.length) {
          return;
        }
        const take = Math.max(1, charsPerTick);
        const delta = s._streamBuffer.slice(0, take);
        const rest = s._streamBuffer.slice(take);
        set((prev) => {
          const msgs = [...prev.messages];
          const last = msgs[msgs.length - 1];
          if (!last || last.role !== "ai" || last.id !== s._streamId) {
            const id = s._streamId ?? `stream:${crypto.randomUUID()}`;
            msgs.push({ id, role: "ai", content: delta });
            // restが空で確定待ちがある場合はここで確定
            if (rest.length === 0 && prev._pendingFinal && id === s._streamId) {
              msgs[msgs.length - 1] = {
                id: prev._pendingFinal.id,
                role: prev._pendingFinal.role,
                content: msgs[msgs.length - 1].content,
              };
              return {
                messages: msgs,
                _streamBuffer: rest,
                _streamId: null,
                _pendingFinal: null,
                isLoading: false,
              };
            }
            return { messages: msgs, _streamBuffer: rest, _streamId: id };
          } else {
            msgs[msgs.length - 1] = { ...last, content: last.content + delta };
          }
          if (rest.length === 0 && prev._pendingFinal && s._streamId) {
            // バッファを使い切ったので、IDを確定版に差し替える
            msgs[msgs.length - 1] = {
              id: prev._pendingFinal.id,
              role: prev._pendingFinal.role,
              content: msgs[msgs.length - 1].content,
            };
            return {
              messages: msgs,
              _streamBuffer: rest,
              _streamId: null,
              _pendingFinal: null,
              isLoading: false,
            };
          }
          return { messages: msgs, _streamBuffer: rest };
        });
      },
      Math.max(10, tickMs),
    ) as unknown as number;
    set({ _streamIntervalId: interval });
  },
  typewriter: { charsPerTick: 1, tickMs: 180 },
  setTypewriter: (opts) => {
    set((s) => ({
      typewriter: {
        ...(s.typewriter ?? { charsPerTick: 1, tickMs: 180 }),
        ...opts,
      },
    }));
    const t = get()._streamIntervalId;
    if (t !== null) {
      clearInterval(t);
      set({ _streamIntervalId: null });
      get()._ensureStreamTicker();
    }
  },

  connect: () => {
    if (get()._manager) return;

    const manager = new WebSocketManager<ServerMessage, ClientMessage>(WS_URL, {
      onOpen: (m) => {
        set((s) => ({ isConnected: true, isLoading: s.isLoading }));
        m.send({ type: "session_create", data: null });
      },
      onMessage: (data) => {
        switch (data.type) {
          case "session_created": {
            set((s) => ({
              sessionId: data.data.session.id,
              isLoading: s.isLoading,
            }));
            const { _manager, pendingQueue } = get();
            if (_manager && pendingQueue.length) {
              for (const content of pendingQueue) {
                _manager.send({
                  type: "chat",
                  data: { sessionId: data.data.session.id, message: content },
                  messageId: crypto.randomUUID(),
                });
              }
              set({ pendingQueue: [] });
            }
            break;
          }
          case "chat_response": {
            const m = data.data.message;
            set((s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last && last.role === "ai" && last.id.startsWith("stream:")) {
                // ストリーム仮IDを確定IDに置換。テキストはそのまま（すでに連結済み）
                msgs[msgs.length - 1] = {
                  id: m.id,
                  role: m.role,
                  content: last.content,
                };
              } else {
                msgs.push({ id: m.id, role: m.role, content: m.content });
              }
              return {
                isLoading: false,
                messages: msgs,
                _streamId: null,
                _streamBuffer: "",
                _pendingFinal: null,
              };
            });
            {
              const t = get()._streamIntervalId;
              if (t !== null) {
                clearInterval(t);
                set({ _streamIntervalId: null });
              }
            }
            break;
          }
          case "processing": {
            const delta = data.data.delta ?? "";
            const streamId = `stream:${data.messageId ?? "unknown"}`;
            set((s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (!last || last.role !== "ai" || last.id !== streamId) {
                msgs.push({ id: streamId, role: "ai", content: delta });
              } else {
                msgs[msgs.length - 1] = {
                  ...last,
                  content: last.content + delta,
                };
              }
              return { messages: msgs, isLoading: true, _streamId: streamId };
            });
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

    set({ _manager: manager, error: null });
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

    _manager?.send({
      type: "chat",
      data: { sessionId, message: content },
      messageId: crypto.randomUUID(),
    });
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
