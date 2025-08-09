import { AppLayout } from "@/sidepanel/AppLayout";
import "@/globals.css";
import { useChat } from "@/hooks/useChat";
import { useGithubOAuth } from "@/hooks/api/useGithubOAuth";
import { useEffect } from "react";
// import { SelectRepository } from "@/components/SelectRepository";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatArea } from "@/components/ChatArea";
import { ChatInput } from "@/components/ChatInput";

function SidePanel() {
  const { start, isLoggedIn } = useGithubOAuth();

  useEffect(() => {
    // 読み込み時にログイン状態でなければ、認証フローを開始する
    if (!isLoggedIn) {
      console.log("start");
      start();
    }
  }, [isLoggedIn, start]);

  useChat();

  /**
   * React Queryの設定
   */
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 20,
        retry: 1,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <ChatArea />
        <ChatInput />
        {/* <SelectRepository /> */}
      </AppLayout>
    </QueryClientProvider>
  );
}

export default SidePanel;
