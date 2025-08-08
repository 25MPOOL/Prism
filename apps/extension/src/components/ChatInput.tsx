import { useCallback, useState } from "react";
import { useChat } from "@/hooks/useChat";

export const ChatInput = () => {
  const { sendMessage, ready, isLoading } = useChat();
  const [value, setValue] = useState("");

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || isLoading) return;

    sendMessage(text);
    setValue("");
  }, [value, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="w-full px-4 pb-4">
      <form
        className="-outline-offset-1 rounded-xl border border-[#3d444d] outline-2 outline-[#316dca]"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="flex flex-col">
          <div className="whitespace-pre-wrap">
            <textarea
              className="w-full resize-none bg-transparent p-4 leading-6 focus:outline-none"
              placeholder="Prismと相談!"
              autoComplete="off"
              spellCheck="false"
              aria-multiline="true"
              style={{ height: 56 }} // TODO: テキストエリアの高さを動的にする
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!ready || isLoading}
            />
          </div>
          <div className="flex items-center justify-between px-2 pb-2">
            {/* TODO: 追加ボタン (今後追加されるかも?) */}
            <button
              type="button"
              className="flex h-8 flex-shrink-0 place-content-center rounded-md border border-transparent px-1.5 duration-75 hover:bg-[#656c7626]"
            >
              <span className="grid flex-auto grid-cols-[min-content_minmax(0,auto)_min-content] content-center items-center justify-center">
                <span className="mr-2 flex">
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    className="inline-block overflow-visible fill-current"
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                    fill="currentColor"
                    display="inline-block"
                    overflow="visible"
                  >
                    <path d="M12.212 3.02a1.753 1.753 0 0 0-2.478.003l-5.83 5.83a3.007 3.007 0 0 0-.88 2.127c0 .795.315 1.551.88 2.116.567.567 1.333.89 2.126.89.79 0 1.548-.321 2.116-.89l5.48-5.48a.75.75 0 0 1 1.061 1.06l-5.48 5.48a4.492 4.492 0 0 1-3.177 1.33c-1.2 0-2.345-.487-3.187-1.33a4.483 4.483 0 0 1-1.32-3.177c0-1.195.475-2.341 1.32-3.186l5.83-5.83a3.25 3.25 0 0 1 5.553 2.297c0 .863-.343 1.691-.953 2.301L7.439 12.39c-.375.377-.884.59-1.416.593a1.998 1.998 0 0 1-1.412-.593 1.992 1.992 0 0 1 0-2.828l5.48-5.48a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-5.48 5.48a.492.492 0 0 0 0 .707.499.499 0 0 0 .352.154.51.51 0 0 0 .356-.154l5.833-5.827a1.755 1.755 0 0 0 0-2.481Z"></path>
                  </svg>
                </span>
                <span>Attach</span>
              </span>
            </button>
            {/* TODO: クリックした時に、Gemini APIにリクエストを送信する */}
            <button
              type="submit"
              disabled={!ready || isLoading || !value.trim()}
              className="inline-grid h-8 w-8 flex-shrink-0 place-content-center rounded-md border border-transparent px-1.5 duration-75 hover:bg-[#656c7626]"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                className="inline-block overflow-visible fill-current"
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="currentColor"
                display="inline-block"
                overflow="visible"
              >
                <path d="M.989 8 .064 2.68a1.342 1.342 0 0 1 1.85-1.462l13.402 5.744a1.13 1.13 0 0 1 0 2.076L1.913 14.782a1.343 1.343 0 0 1-1.85-1.463L.99 8Zm.603-5.288L2.38 7.25h4.87a.75.75 0 0 1 0 1.5H2.38l-.788 4.538L13.929 8Z"></path>
              </svg>
            </button>
            {/* TODO: ホバー時に、ボタンの説明を出すようにする */}
          </div>
        </div>
      </form>
    </div>
  );
};
