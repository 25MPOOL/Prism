import { client } from "@/utils/client";
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

interface Response {
  success: boolean;
}

export const postLogout = (): Promise<Response> => {
  return client.post("auth/logout");
};

type UsePostLogoutOptions = Omit<
  UseMutationOptions<Response, Error, void, unknown>,
  "mutationFn"
>;

export const usePostLogout = (options?: UsePostLogoutOptions) => {
  const { onSuccess, onError, onMutate, onSettled, ...restConfig } =
    options || {};

  const queryClient = useQueryClient();

  return useMutation<Response, Error, void, unknown>({
    onSuccess: async (response, variables, context) => {
      queryClient.invalidateQueries();

      if (chrome.storage.local) {
        console.log("chrome.storage.local");
        await chrome.storage.local.clear();
      }

      alert("ログアウトしました");

      onSuccess?.(response, variables, context);
    },
    onError: (error, variables, context) => {
      console.error("ログアウトに失敗しました", error);

      onError?.(error, variables, context);
    },
    onMutate: (variables) => {
      onMutate?.(variables);
    },
    onSettled: (data, error, variables, context) => {
      onSettled?.(data, error, variables, context);
    },
    ...restConfig,
    mutationFn: postLogout,
  });
};
