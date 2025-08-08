import { memo } from "react";

interface UserQueryProps {
  content: string;
}

export const UserQuery = memo((props: UserQueryProps) => {
  const { content } = props;

  return (
    <div className="w-full">
      <div className="-outline-offset-1 rounded-md border border-[#3d444d] outline-2 outline-[#316dca]">
        <div className="rounded-md bg-[#262c36] p-2">
          <p className="whitespace-pre-wrap leading-6">{content}</p>
        </div>
      </div>
    </div>
  );
});
