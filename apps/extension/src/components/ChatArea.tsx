import { useEffect } from "react";
import { ModelResponse } from "./ModelResponse";
import { UserQuery } from "./UserQuery";
import { useChat } from "@/hooks/useChat";

export const ChatArea = () => {
  const { messages, isLoading } = useChat();

  useEffect(() => {
    console.log(messages);
  }, [messages]);

  return (
    <div className="grow overflow-y-auto p-4">
      <div className="flex grow flex-col gap-4">
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
              <div className="inline-flex items-center gap-2 rounded-md bg-[#1f242b] px-3 py-2">
                <div className="typing-dots">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
