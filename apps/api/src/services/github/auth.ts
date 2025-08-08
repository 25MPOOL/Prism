import type {
  GitHubTokenResponse,
  GitHubUserProfile,
} from "../../types/github"; // 型定義をインポート

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

/**
 * GitHubのアクセストークンを使ってユーザープロファイルを取得する関数。
 * @param accessToken GitHubアクセストークン
 * @returns GitHubユーザープロファイルオブジェクト、またはnull
 */
export async function getGitHubUserProfile(
  accessToken: string,
): Promise<GitHubUserProfile | null> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`, // アクセストークンをヘッダーに含める
        "User-Agent": "Prism-extension", // GitHub APIの要件: User-Agentヘッダー
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to get GitHub user profile: ${response.status} ${response.statusText}`,
      );
      const errorData = await response.json();
      console.error("Error details:", errorData);
      return null;
    }

    const userProfile: GitHubUserProfile = await response.json();
    return userProfile;
  } catch (error) {
    console.error("Error fetching GitHub user profile:", error);
    return null;
  }
}
