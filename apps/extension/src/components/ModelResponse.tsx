import { memo, useState } from "react";
import PrismLogo from "@assets/prism.png";
import { SelectRepository } from "./SelectRepository";
import { useCreateIssues } from "@/hooks/api/createIssues";
import { useGetSessionIssues } from "@/hooks/api/getSessionIssues";
import { useChatStore } from "@/store/chatStore";
import type { Repository } from "@/hooks/api/getRepos";

interface ModelResponseProps {
  content: string;
}

export const ModelResponse = memo((props: ModelResponseProps) => {
  const { content } = props;
  const [showRepositorySelection, setShowRepositorySelection] = useState(false);
  const [isCreatingIssues, setIsCreatingIssues] = useState(false);

  const { createIssues } = useCreateIssues();
  const { getSessionIssues } = useGetSessionIssues();
  const sessionId = useChatStore((s) => s.sessionId);

  // リポジトリ選択トリガーを検知
  const shouldShowRepositorySelection = content.includes(
    "[SHOW_REPOSITORY_SELECTION]",
  );

  // 表示用のコンテンツ（トリガーコードを除去）
  const displayContent = content.replace("[SHOW_REPOSITORY_SELECTION]\n", "");

  const handleRepositorySelect = async (selected: Repository[]) => {
    if (selected.length === 0) {
      setShowRepositorySelection(false);
      return;
    }

    if (!sessionId) {
      alert("セッションが見つかりません。ページをリロードしてください。");
      setShowRepositorySelection(false);
      return;
    }

    setIsCreatingIssues(true);
    try {
      // セッションから生成されたIssueを取得
      const issues = await getSessionIssues(sessionId);

      // 選択された各リポジトリにIssueを作成
      for (const repository of selected) {
        await createIssues(repository.fullName, issues);
      }

      alert(
        `${selected.length}個のリポジトリに${issues.length}個のIssueを登録しました!`,
      );
    } catch (error) {
      console.error("Issue登録に失敗しました:", error);
      let errorMessage = "Issue登録に失敗しました。";
      if (error instanceof Error) {
        errorMessage = `Issue登録に失敗しました。\n詳細: ${error.message}`;
      }
      alert(`${errorMessage}\n\nもう一度お試しください。`);
    } finally {
      setIsCreatingIssues(false);
      setShowRepositorySelection(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-start gap-2">
        {/* TODO: SVGにして、無駄な余白とか消してピッタリに配置したい */}
        <div className="flex h-8 w-8 items-center justify-center">
          <img src={PrismLogo} alt="prism" />
        </div>
        <div className="whitespace-pre-wrap leading-6">{displayContent}</div>

        {shouldShowRepositorySelection && (
          <button
            type="button"
            onClick={() => setShowRepositorySelection(true)}
            disabled={isCreatingIssues}
            className="mt-2 rounded-md bg-[#238636] px-4 py-2 text-sm text-white hover:bg-[#2ea043] disabled:opacity-50"
          >
            {isCreatingIssues ? "Issue登録中..." : "リポジトリを選択"}
          </button>
        )}
      </div>

      {showRepositorySelection && (
        <SelectRepository
          onCancel={() => setShowRepositorySelection(false)}
          onConfirm={handleRepositorySelect}
        />
      )}
    </div>
  );
});
