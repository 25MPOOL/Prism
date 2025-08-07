import { memo } from "react";

interface UserOutputProps {
  text: string;
}

export const UserOutput = memo((props: UserOutputProps) => {
  const { text } = props;

  return (
    <div className="w-full">
      <div className="-outline-offseet-1 rounded-md border border-[#3d444d] outline-2 outline-[#316dca]">
        <div className="whitespace-pre-wrap rounded-md bg-[#262c36] p-2 leading-6">
          {text}
        </div>
      </div>
    </div>
  );
});
