import { useEffect, useRef, useCallback } from "react";
import { ModelResponse } from "./ModelResponse";
import { UserQuery } from "./UserQuery";
import { useChat } from "@/hooks/useChat";
import PrismLogo from "@assets/prism.png";

export const ChatArea = () => {
  const { messages, isLoading } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messages.length === 0 && !isLoading) return;
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, isLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <div ref={containerRef} className="chat-scroll grow overflow-y-auto p-4">
      <div className="flex flex-col gap-4">
        {messages.map((m) =>
          m.role === "user" ? (
            <UserQuery key={m.id} content={m.content} />
          ) : (
            <ModelResponse key={m.id} content={m.content} />
          ),
        )}
        {isLoading && (
          <div className="w-full">
            <div className="flex flex-col items-start gap-2">
              <div className="flex h-8 w-8 items-center justify-center">
                <img src={PrismLogo} alt="prism" className="animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
