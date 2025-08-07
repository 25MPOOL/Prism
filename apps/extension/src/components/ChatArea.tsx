import { AIOutput } from "./AIOutput";
import { UserOutput } from "./UserOutput";

export const ChatArea = () => {
  return (
    <div className="flex grow flex-col gap-4">
      <UserOutput text="こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！こんにちは！" />
      <AIOutput text="こんにちは、こんにちは、こんにちは、こんにちは、こんにちは、こんにちは" />
    </div>
  );
};
