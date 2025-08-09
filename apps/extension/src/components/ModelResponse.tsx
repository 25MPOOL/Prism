import { memo, useState } from "react";
import PrismLogo from "@assets/prism.png";
import { SelectRepository } from "./SelectRepository";

interface ModelResponseProps {
  content: string;
}

export const ModelResponse = memo((props: ModelResponseProps) => {
  const { content } = props;
  const [showRepositorySelection, setShowRepositorySelection] = useState(false);

  // リポジトリ選択トリガーを検知
  const shouldShowRepositorySelection = content.includes(
    "[SHOW_REPOSITORY_SELECTION]",
  );

  // 表示用のコンテンツ（トリガーコードを除去）
  const displayContent = content.replace("[SHOW_REPOSITORY_SELECTION]\n", "");

  const handleRepositorySelect = (selected: any[]) => {
    console.log("Selected repositories:", selected);
    setShowRepositorySelection(false);
    // TODO: 選択されたリポジトリでIssue登録処理を実行
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
            className="mt-2 rounded-md bg-[#238636] px-4 py-2 text-sm text-white hover:bg-[#2ea043]"
          >
            リポジトリを選択
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
