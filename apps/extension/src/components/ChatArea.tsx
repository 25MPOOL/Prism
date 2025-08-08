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
        {isLoading && <ModelResponse content="Thinking..." />}
      </div>
    </div>
  );
};
