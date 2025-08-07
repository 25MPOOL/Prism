import { ModelResponse } from "./ModelResponse";
import { UserQuery } from "./UserQuery";

export const ChatArea = () => {
  return (
    <div className="flex grow flex-col gap-4">
      <UserQuery text="こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！" />
      <ModelResponse text="こんにちは、こんにちは、こんにちは、こんにちは、こんにちは、こんにちは" />
    </div>
  );
};
