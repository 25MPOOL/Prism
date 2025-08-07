import { memo } from "react";

interface ModelResponseProps {
  text: string;
}

export const ModelResponse = memo((props: ModelResponseProps) => {
  const { text } = props;

  return (
    <div className="w-full">
      <div className="flex flex-col items-start gap-2">
        {/* TODO: アイコンに変更する */}
        <div className="h-8 w-8 rounded-full bg-[#3d444d]" />
        <div className="whitespace-pre-wrap leading-6">{text}</div>
      </div>
    </div>
  );
});
