interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = (props: AppLayoutProps) => {
  const { children } = props;

  return (
    <div className="flex min-h-full w-full flex-col">
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
          {/* TODO: 3点リーダー */}
          <button
            className="h-8 w-8 rounded-md border border-[#3d444d]"
            type="button"
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
      <main className="flex grow flex-col p-4">{children}</main>
    </div>
  );
};
