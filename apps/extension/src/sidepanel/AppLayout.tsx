import { useChatStore } from "@/store/chatStore";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = (props: AppLayoutProps) => {
  const { children } = props;

  const sessionId = useChatStore((s) => s.sessionId);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const handleGenerateRequirements = async () => {
    console.log("要件定義書生成ボタンがクリックされました");
    console.log("現在のセッションID", sessionId);
    if (!sessionId) {
      alert("セッションが見つかりません。会話を開始してください。");
      return;
    }

    sendMessage("要件定義書を生成");
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex w-full items-center justify-between gap-3 bg-[#151b23] p-4 shadow-inner-bottom">
        <h1 className="font-bold text-xl">Prism</h1>
        <div className="flex items-center gap-2">
          {/* TODO: 新しいチャットを開くボタン */}
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d]"
            type="button"
          >
            A
          </button>
          {/* TODO: チャット履歴を開くボタン */}
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d]"
            type="button"
          >
            A
          </button>
          {/* 要件定義書生成ボタン */}
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d] hover:bg-[#21262d]"
            type="button"
            onClick={handleGenerateRequirements}
            title="要件定義書を生成"
          >
            A
          </button>
          {/* TODO: 閉じるボタンまたは、ユーザーアイコン ログアウトとか */}
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d]"
            type="button"
          >
            A
          </button>
        </div>
      </header>
      <main className="flex min-h-0 grow flex-col">{children}</main>
    </div>
  );
};
