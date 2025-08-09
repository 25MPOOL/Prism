import { client } from "@/utils/client";
import { useCallback } from "react";

export interface CreateIssueRequest {
  title: string;
  description: string;
}

export interface CreatedIssue {
  id: number;
  number: number;
  title: string;
  url: string;
  html_url: string;
  state: string;
}

interface BulkCreateResponse {
  success: boolean;
  issues: CreatedIssue[];
  total: number;
}

// extension storageからuserIdを取得
const getUserId = async (): Promise<string> => {
  const userId = await chrome.storage.local.get("userId");
  return userId.userId;
};

// api呼び出し
const api = (
  userId: string,
  owner: string,
  repo: string,
  issues: CreateIssueRequest[],
): Promise<BulkCreateResponse> => {
  return client.post("github/issues/bulk", {
    userId,
    owner,
    repo,
    issues,
  });
};

/**
 * Issue一括作成
 */
export const useCreateIssues = () => {
  const createIssues = useCallback(
    async (
      repositoryFullName: string,
      issues: CreateIssueRequest[],
    ): Promise<CreatedIssue[]> => {
      const userId = await getUserId();
      const [owner, repo] = repositoryFullName.split("/");

      const res = await api(userId, owner, repo, issues);
      return res.issues;
    },
    [],
  );

  return { createIssues };
};
