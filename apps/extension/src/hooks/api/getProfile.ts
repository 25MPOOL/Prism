import { getUserId } from "@/helpers";
import { client } from "@/utils/client";
import { useCallback } from "react";

interface ApiResponse {
  success: boolean;
  user: {
    id: string;
    githubId: number;
    githubUsername: string;
    name: string;
    avatarUrl: string;
  };
}

export interface Profile extends ApiResponse {}

const api = (userId: string): Promise<ApiResponse> => {
  return client.get(`github/profile`, { userId });
};

/**
 * ユーザー情報を取得する
 */
export const useGetProfile = () => {
  const fetchProfile = useCallback(async (): Promise<Profile> => {
    const userId = await getUserId();
    const res = await api(userId);

    return res;
  }, []);

  return { fetchProfile };
};
