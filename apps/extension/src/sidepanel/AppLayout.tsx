interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = (props: AppLayoutProps) => {
  const { children } = props;

  return (
    <div className="flex flex-col min-h-full w-full">
      <header className="shadow-inner-bottom p-4 w-full bg-[#151b23] gap-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Prism</h1>
        <div className="flex items-center gap-2">
          {/* TODO: 新しいチャットを開くボタン */}
          <button
            className="h-8 w-8 border border-[#3d444d] rounded-md"
            type="button"
          >
            A
          </button>
          {/* TODO: チャット履歴を開くボタン */}
          <button
            className="h-8 w-8 border border-[#3d444d] rounded-md"
            type="button"
          >
            A
          </button>
          {/* TODO: 3点リーダー */}
          <button
            className="h-8 w-8 border border-[#3d444d] rounded-md"
            type="button"
          >
            A
          </button>
          {/* TODO: 閉じるボタンまたは、ユーザーアイコン ログアウトとか */}
          <button
            className="h-8 w-8 border border-[#3d444d] rounded-md"
            type="button"
          >
            A
          </button>
        </div>
      </header>
      <main className="grow p-4 flex flex-col">{children}</main>
    </div>
  );
};
