import type { GitHubTokenResponse } from "../../types/github"; // 型定義をインポート

/**
 * GitHubの認証コードを使ってアクセストークンを交換する関数。
 * この関数はHTTPリクエストのハンドリングは行わず、純粋にトークン交換のロジックのみを提供します。
 * @param code GitHubから受け取った認証コード
 * @param clientId GitHub AppのクライアントID
 * @param clientSecret GitHub Appのクライアントシークレット
 * @returns アクセストークンとリフレッシュトークンを含むオブジェクト、またはnull
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<GitHubTokenResponse | null> {
  try {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `Failed to exchange code for tokens: ${response.status} ${response.statusText}`,
      );
      const errorData = await response.json();
      console.error("Error details:", errorData);
      return null;
    }

    const data: GitHubTokenResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error during token exchange:", error);
    return null;
  }
}
