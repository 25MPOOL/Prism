import { client } from "@/utils/client";
import { useCallback } from "react";

export interface Repository {
  id: string;
  fullName: string;
  avatarUrl: string;
}

interface ApiResponse {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  html_url: string;
  description: string;
  default_branch: string;
  permissions: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
}

interface ApiCollectionResponse {
  repositories: ApiResponse[];
}

// userId: string
/// extension storageからuserIdを取得
const getUserId = async (): Promise<string> => {
  const userId = await chrome.storage.local.get("userId");

  return userId.userId;
};

const api = (userId: string): Promise<ApiCollectionResponse> => {
  return client.get(`github/repos?userId=${userId}`);
};

/**
 * リポジトリ一覧を取得する
 */
export const useGetRepos = () => {
  const fetchRepos = useCallback(async (): Promise<Repository[]> => {
    const userId = await getUserId();
    const res = await api(userId);

    // res (ApiCollectionResponse) -> repositories (ApiResponse[]) -> Repository[]
    const formatted: Repository[] = res.repositories.map((repo) => ({
      id: String(repo.id),
      fullName: repo.full_name,
      avatarUrl: repo.owner.avatar_url,
    }));

    return formatted;
  }, []);

  return { fetchRepos };
};
