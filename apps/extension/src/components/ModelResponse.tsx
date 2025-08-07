import { memo } from "react";
import PrismLogo from "@assets/prism.png";

interface ModelResponseProps {
  text: string;
}

export const ModelResponse = memo((props: ModelResponseProps) => {
  const { text } = props;

  return (
    <div className="w-full">
      <div className="flex flex-col items-start gap-2">
        {/* TODO: SVGにして、無駄な余白とか消してピッタリに配置したい */}
        <div className="flex h-8 w-8 items-center justify-center">
          <img src={PrismLogo} alt="prism" />
        </div>
        <div className="whitespace-pre-wrap leading-6">{text}</div>
      </div>
    </div>
  );
});
