import { AppLayout } from "@/sidepanel/AppLayout";
import { ChatInput } from "@/components/ChatInput";
import { ChatArea } from "@/components/ChatArea";
import "@/globals.css";
import { useChat } from "@/hooks/useChat";
import { useEffect } from "react";

function SidePanel() {
  const { connect, disconnect } = useChat();

  useEffect(() => {
    connect();

    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <AppLayout>
      <ChatArea />
      <ChatInput />
    </AppLayout>
  );
}

export default SidePanel;
