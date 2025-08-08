import { AppLayout } from "@/sidepanel/AppLayout";
import { ChatInput } from "@/components/ChatInput";
import { ChatArea } from "@/components/ChatArea";
import "@/globals.css";
import { useChat } from "@/hooks/useChat";

function SidePanel() {
  useChat();

  return (
    <AppLayout>
      <ChatArea />
      <ChatInput />
    </AppLayout>
  );
}

export default SidePanel;
