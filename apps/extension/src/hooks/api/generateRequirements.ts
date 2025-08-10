import { client } from "@/utils/client";
import { useCallback } from "react";

export const useGenerateRequirements = () => {
  const generateRequirements = useCallback(async (sessionId: string) => {
    console.log("API呼び出し: sessionId =", sessionId);
    const response = await client.post(
      `conversation/${sessionId}/generate-requirements`,
    );
    console.log("API応答:", response);
    return (response as { data: { success: boolean; data: any } }).data;
  }, []);

  return { generateRequirements };
};
