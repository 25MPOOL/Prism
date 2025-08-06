import { AppLayout } from "@/sidepanel/AppLayout";
import { ChatInput } from "@/components/ChatInput";
import { ChatArea } from "@/components/ChatArea";
import "@/globals.css";

function SidePanel() {
  return (
    <AppLayout>
      <ChatArea />
      <ChatInput />
    </AppLayout>
  );
}

export default SidePanel;
