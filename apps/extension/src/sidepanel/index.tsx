import { AppLayout } from "@/sidepanel/AppLayout";
import { ChatInput } from "@/components/ChatInput";
import { ChatArea } from "@/components/ChatArea";
import "@/globals.css";
import { useChat } from "@/hooks/useChat";
import { useGithubOAuth } from "@/hooks/api/useGithubOAuth";
import { useEffect } from "react";

function SidePanel() {
  const { start, isLoggedIn } = useGithubOAuth();

  useEffect(() => {
    // 読み込み時にログイン状態でなければ、認証フローを開始する
    if (!isLoggedIn) {
      start();
    }
  }, [isLoggedIn, start]);

  useChat();

  return (
    <AppLayout>
      <ChatArea />
      <ChatInput />
    </AppLayout>
  );
}

export default SidePanel;
