import { AppLayout } from "@/sidepanel/AppLayout";
import "@/globals.css";
import { useChat } from "@/hooks/useChat";
import { useGithubOAuth } from "@/hooks/api/useGithubOAuth";
import { useEffect, useState } from "react";
// import { SelectRepository } from "@/components/SelectRepository";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatArea } from "@/components/ChatArea";
import { ChatInput } from "@/components/ChatInput";
import { client } from "@/utils/client";

function SidePanel() {
  const { start, isLoggedIn } = useGithubOAuth();
  const { messages, isLoading } = useChat({ autoConnect: false });
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    // 読み込み時にログイン状態でなければ、認証フローを開始する
    if (!isLoggedIn) {
      start();
    }
  }, [isLoggedIn, start]);

  useEffect(() => {
    (async () => {
      try {
        const { userId } = await chrome.storage.local.get("userId");
        if (!userId) return;

        const res = await client.get<{
          success: boolean;
          user: { name: string };
        }>("github/profile", { userId });

        if (res?.success) setDisplayName(res.user.name);
      } catch {}
    })();
  }, []);

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
        {messages.length === 0 ? (
          <div className="flex grow flex-col items-center justify-center">
            <p className="mb-6 text-gray-300 text-xl">
              こんにちは、{displayName ?? "ゲスト"}さん
            </p>
            <div className="w-full max-w-xl">
              <ChatInput />
            </div>
          </div>
        ) : (
          <>
            <ChatArea />
            <ChatInput />
          </>
        )}
        {/* <SelectRepository /> */}
      </AppLayout>
    </QueryClientProvider>
  );
}

export default SidePanel;
