import { useChatStore } from "@/store/chatStore";
import { useEffect, useMemo } from "react";

export const useChat = (opts: { autoConnect?: boolean } = {}) => {
  const { autoConnect = true } = opts;

  const messages = useChatStore((s) => s.messages);
  const isConnected = useChatStore((s) => s.isConnected);
  const isLoading = useChatStore((s) => s.isLoading);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const connect = useChatStore((s) => s.connect);
  const disconnect = useChatStore((s) => s.disconnect);
  const newChat = useChatStore((s) => s.newChat);
  const reset = useChatStore((s) => s.reset);

  useEffect(() => {
    if (!autoConnect) return;

    connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  const sessionId = useChatStore((s) => s.sessionId);
  const ready = isConnected && !!sessionId;

  // 最初のメッセージ
  const firstMessage = useMemo(
    () => (messages.length ? messages[0] : null),
    [messages],
  );

  return {
    messages,
    firstMessage,
    isConnected,
    isLoading,
    connect,
    disconnect,
    sendMessage,
    ready,
    newChat,
    reset,
  };
};
