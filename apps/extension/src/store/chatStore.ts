import { create } from "zustand";

interface UiMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
}

interface ChatState {
  messages: UiMessage[];
  isConnected: boolean;
  isLoading: boolean;
  sessionId: string | null;
  _ws: WebSocket | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (text: string) => void;
  newChat: () => void;
}

const WS_URL = "wss://prism-api.kaitomichigan22.workers.dev/ws/connect";

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isConnected: false,
  isLoading: false,
  sessionId: null,
  _ws: null,

  connect: () => {
    const curr = get()._ws;
    if (
      curr &&
      (curr.readyState === WebSocket.OPEN ||
        curr.readyState === WebSocket.CONNECTING)
    )
      return;

    const ws = new WebSocket(WS_URL);
    set({ _ws: ws });

    ws.onopen = () => {
      set({ isConnected: true });
      ws.send(JSON.stringify({ type: "session_create", data: null }));
    };

    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data) as
        | { type: "session_created"; data: { session: { id: string } } }
        | {
            type: "chat_response";
            data: {
              message: { id: string; role: "user" | "ai"; content: string };
            };
          }
        | { type: "error"; data: { error?: string } }
        | { type: "pong"; data: { timestamp: string } };

      if (data.type === "session_created") {
        set({ sessionId: data.data.session.id });
        return;
      }
      if (data.type === "chat_response") {
        set({ isLoading: false });
        const m = data.data.message;
        set((s) => ({
          messages: [
            ...s.messages,
            { id: m.id, sender: m.role, text: m.content },
          ],
        }));
        return;
      }
      if (data.type === "error") {
        set({ isLoading: false });
        console.error("WS error:", data.data?.error);
      }
    };

    ws.onerror = (e) => {
      console.error("WS error:", e);
      set({ isConnected: false, isLoading: false });
    };

    ws.onclose = () => {
      set({ isConnected: false, sessionId: null, _ws: null });
    };
  },
  disconnect: () => {
    const ws = get()._ws;
    ws?.close();
  },

  sendMessage: (text: string) => {
    const ws = get()._ws;
    const sid = get().sessionId;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sid) {
      console.error("WebSocket not ready or no session");
      return;
    }
    set((s) => ({
      messages: [
        ...s.messages,
        { id: crypto.randomUUID(), sender: "user", text },
      ],
      isLoading: true,
    }));
    ws.send(
      JSON.stringify({ type: "chat", data: { sessionId: sid, message: text } }),
    );
  },

  newChat: () => {
    const ws = get()._ws;
    set({ messages: [], isLoading: false });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "session_create", data: null }));
    } else {
      get().connect();
    }
  },
}));
