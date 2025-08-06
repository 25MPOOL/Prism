export const ChatInput = () => {
  return (
    <div className="w-full">
      <form className="outline-2 outline-[#316dca] -outline-offset-1 border border-[#3d444d] rounded-xl">
        <div className="flex flex-col">
          <div className="whitespace-pre-wrap">
            <textarea
              className="bg-[#0000] p-4 w-full resize-none focus:outline-none"
              placeholder="Prismと相談!"
              autoComplete="off"
              spellCheck="false"
              aria-multiline="true"
              style={{ height: 56 }}
            >
              aaaaaaa
            </textarea>
          </div>
          <div className="flex items-center justify-between pb-2 px-2">
            {/* TODO: 追加ボタン (今後追加されるかも?) */}
            {/* TODO: アイコンに後で変える */}
            <div className="px-2">追加</div>
            <div className="px-2">送信</div>
          </div>
        </div>
      </form>
    </div>
  );
};
