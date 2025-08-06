import { AppLayout } from "@/sidepanel/AppLayout";
import { ChatInput } from "@/components/ChatInput";
import "@/globals.css";

function SidePanel() {
  return (
    <AppLayout>
      <div className="grow">SidePanel</div>
      <ChatInput />
    </AppLayout>
  );
}

export default SidePanel;
