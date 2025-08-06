export const ChatInput = () => {
  return (
    <div className="w-full">
      <form className="-outline-offset-1 rounded-xl border border-[#3d444d] outline-2 outline-[#316dca]">
        <div className="flex flex-col">
          <div className="whitespace-pre-wrap">
            <textarea
              className="w-full resize-none bg-transparent p-4 focus:outline-none"
              placeholder="Prismと相談!"
              autoComplete="off"
              spellCheck="false"
              aria-multiline="true"
              style={{ height: 56 }}
            >
              aaaaaaa
            </textarea>
          </div>
          <div className="flex items-center justify-between px-2 pb-2">
            {/* TODO: 追加ボタン (今後追加されるかも?) */}
            {/* TODO: アイコンに後で変える */}
            <div className="px-1.5">追加</div>
            {/* TODO: クリックした時に、Gemini APIにリクエストを送信する */}
            <button
              type="button"
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
