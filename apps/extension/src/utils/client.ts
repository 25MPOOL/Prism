import "dotenv/config";

export const baseUrl = "https://prism-api.kaitomichigan22.workers.dev/";

const baseHeaders = {
  "Content-Type": "application/json",
};

/**
 * fetchのレスポンスをハンドリングする共通関数
 * @param response fetchのレスポンス
 */
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    // APIからのエラーレスポンスを考慮し、bodyをテキストで取得
    const errorBody = await response.text();
    console.error("API Error Response:", errorBody);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // 成功時はJSONとしてパースして返す
  return response.json() as Promise<T>;
};

/**
 * GET/DELETEリクエスト用の共通関数
 * @param method HTTPメソッド
 * @param path APIのパス
 * @param params クエリパラメータ
 */
const requestWithoutBody =
  (method: "GET" | "DELETE") =>
  async <T>(path: string, params?: Record<string, any>): Promise<T> => {
    const url = new URL(`${baseUrl}${path}`);
    if (params) {
      // オブジェクトのキーと値が `undefined` や `null` の場合、除外する
      const filteredParams = Object.fromEntries(
        Object.entries(params).filter(([, value]) => value != null),
      );
      url.search = new URLSearchParams(filteredParams).toString();
    }

    const response = await fetch(url.toString(), {
      method,
      headers: baseHeaders,
      credentials: "include",
    });
    return handleResponse<T>(response);
  };

/**
 * POST/PUTリクエスト用の共通関数
 * @param method HTTPメソッド
 * @param path APIのパス
 * @param params リクエストボディ
 */
const requestWithBody =
  (method: "POST" | "PUT") =>
  async <T>(path: string, data?: Record<string, any>): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: baseHeaders,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    return handleResponse<T>(response);
  };

export const client = {
  get: requestWithoutBody("GET"),
  post: requestWithBody("POST"),
  put: requestWithBody("PUT"),
  delete: requestWithoutBody("DELETE"),
};
