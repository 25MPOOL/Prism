import { client } from "@/utils/client";
import { useCallback } from "react";

export interface GeneratedIssue {
  title: string;
  description: string;
}

// extension storageからuserIdを取得
const _getUserId = async (): Promise<string> => {
  const userId = await chrome.storage.local.get("userId");
  return userId.userId;
};

const api = (sessionId: string): Promise<{ issues: GeneratedIssue[] }> => {
  return client.get(`conversation/${sessionId}/issues`);
};

/**
 * セッションから生成されたIssue一覧を取得
 */
export const useGetSessionIssues = () => {
  const getSessionIssues = useCallback(
    async (sessionId: string): Promise<GeneratedIssue[]> => {
      const res = await api(sessionId);
      return res.issues;
    },
    [],
  );

  return { getSessionIssues };
};
