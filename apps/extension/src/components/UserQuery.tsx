import { memo } from "react";

interface UserQueryProps {
  text: string;
}

export const UserQuery = memo((props: UserQueryProps) => {
  const { text } = props;

  return (
    <div className="w-full">
      <div className="-outline-offseet-1 rounded-md border border-[#3d444d] outline-2 outline-[#316dca]">
        <div className="rounded-md bg-[#262c36] p-2">
          <p className="whitespace-pre-wrap leading-6">{text}</p>
        </div>
      </div>
    </div>
  );
});
