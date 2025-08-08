import { ModelResponse } from "./ModelResponse";
import { UserQuery } from "./UserQuery";
import { useChat } from "@/hooks/useChat";

export const ChatArea = () => {
  const { messages, isLoading } = useChat();

  return (
    <div className="grow overflow-y-auto p-4">
      <div className="flex grow flex-col gap-4">
        {messages.map((m) =>
          m.sender === "user" ? (
            <UserQuery key={m.id} text={m.text} />
          ) : (
            <ModelResponse key={m.id} text={m.text} />
          ),
        )}
        {isLoading && <ModelResponse text="Thinking..." />}
      </div>
    </div>
  );
};
