import { useCallback } from "react";
import { useStorage } from "@plasmohq/storage/hook";
import { Storage } from "@plasmohq/storage";

export const useGithubOAuth = () => {
  // `local` ストレージの `isLoggedIn` を監視する
  const [isLoggedIn] = useStorage({
    key: "isLoggedIn",
    instance: new Storage({
      area: "local",
    }),
  });

  // バックグラウンドに認証開始のメッセージを送る関数
  const start = useCallback(async () => {
    await chrome.runtime.sendMessage({
      type: "START_GITHUB_OAUTH",
    });
  }, []);

  return { isLoggedIn, start };
};
