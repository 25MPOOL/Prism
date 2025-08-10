import { memo, useState } from "react";

interface MarkdownRendererProps {
  content: string;
}

// 極力シンプルなMarkdownレンダラー
// - 見出し: #, ##, ###
// - 箇条書き: - で始まる行（連続行を<ul>にまとめる）
// - 空行は段落の区切り
export const MarkdownRenderer = memo((props: MarkdownRendererProps) => {
  const { content } = props;

  // ブロック単位で要素を生成
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // コードブロック ```lang\n ... \n```
    if (line.startsWith("```")) {
      const _lang = line.slice(3).trim();
      const codeLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith("```")) {
        codeLines.push(lines[j]);
        j += 1;
      }
      // j は閉じ```の行位置 or 行末
      const code = codeLines.join("\n");
      const Copyable = () => {
        const [copied, setCopied] = useState(false);
        const onCopy = async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {}
        };
        return (
          <div className="group relative">
            <pre className="overflow-x-hidden rounded-md bg-[#0d1117] p-3 ring-1 ring-[#30363d]">
              <code className="whitespace-pre-wrap break-words font-mono text-sm">
                {code}
              </code>
            </pre>
            <button
              type="button"
              onClick={onCopy}
              className="absolute top-2 right-2 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-[#c9d1d9] text-xs opacity-0 transition-opacity hover:bg-[#21262d] group-hover:opacity-100"
              aria-label="Copy code"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        );
      };
      elements.push(<Copyable key={`pre-${i}`} />);
      i = j < lines.length ? j + 1 : j;
      continue;
    }

    // 箇条書きブロック
    if (line.trim().startsWith("- ")) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("- ")) {
        items.push(lines[j].trim().slice(2));
        j += 1;
      }
      elements.push(
        <ul key={`ul-${i}`} className="ml-5 list-disc space-y-1">
          {items.map((item) => {
            const key = `li-${i}-${item}-${Math.random().toString(36).slice(2, 8)}`;
            return (
              <li key={key} className="leading-6">
                {item}
              </li>
            );
          })}
        </ul>,
      );
      i = j;
      continue;
    }

    // 見出し
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="mt-4 mb-2 font-semibold text-base">
          {line.slice(4)}
        </h3>,
      );
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="mt-5 mb-3 font-bold text-lg">
          {line.slice(3)}
        </h2>,
      );
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${i}`} className="mt-6 mb-4 font-bold text-xl">
          {line.slice(2)}
        </h1>,
      );
      i += 1;
      continue;
    }

    // 空行 → 間隔
    if (line.trim() === "") {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      i += 1;
      continue;
    }

    // 段落
    elements.push(
      <p key={`p-${i}`} className="leading-6">
        {line}
      </p>,
    );
    i += 1;
  }

  return <div className="space-y-1 break-words">{elements}</div>;
});

MarkdownRenderer.displayName = "MarkdownRenderer";
