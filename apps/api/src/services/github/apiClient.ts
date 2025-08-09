import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../../../drizzle/schema";
import type { AppEnv } from "../../types/definitions";
import { getValidGitHubAccessToken } from "../user"; // getValidGitHubAccessTokenをインポート

/**
 * GitHub APIを呼び出すための共通クライアント関数。
 * 有効なアクセストークンを自動的に取得・リフレッシュし、リクエストに含めます。
 * @param db Drizzleデータベースインスタンス
 * @param userId Prism内部のユーザーID
 * @param env 環境変数 (AppEnv)
 * @param path GitHub APIのエンドポイントパス (例: '/user/repos', '/repos/owner/repo/issues')
 * @param method HTTPメソッド (GET, POST, PUT, DELETEなど)
 * @param body リクエストボディ (POST/PUTの場合)
 * @returns GitHub APIからのJSONレスポンス
 * @throws Error GitHub API呼び出し失敗時、または有効なトークンが取得できない場合
 */
export async function callGitHubApi<T>(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  env: AppEnv,
  path: string,
  method: string = "GET",
  body?: object,
): Promise<T> {
  // 有効なアクセストークンを取得 (期限切れの場合は自動リフレッシュ)
  const accessToken = await getValidGitHubAccessToken(
    db,
    userId,
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
  );

  if (!accessToken) {
    throw new Error(
      "有効なGitHubアクセストークンを取得できませんでした。ユーザーは再認証が必要かもしれません。",
    );
  }

  const url = `https://api.github.com${path}`;
  const headers: HeadersInit = {
    Authorization: `token ${accessToken}`,
    "User-Agent": "Prism-extension", // GitHub APIの要件
    Accept: "application/vnd.github.v3+json", // GitHub APIの推奨Acceptヘッダー
  };

  const requestOptions: RequestInit = {
    method: method,
    headers: headers,
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `GitHub API呼び出し失敗 (${method} ${path}): ${response.status} ${response.statusText} - ${errorText}`,
      );
      throw new Error(
        `GitHub API呼び出し失敗: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    // レスポンスが空の場合 (例: 204 No Content) はnullを返す
    if (response.status === 204) {
      return null as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(
      `GitHub API呼び出し中にエラーが発生しました (${method} ${path}):`,
      error,
    );
    throw error;
  }
}
