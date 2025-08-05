/**
 * GitHub関連の環境変数の型定義。
 * HonoのBindingsに統合される際に使用されます。
 */
export interface GithubEnv {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_REDIRECT_URI: string; // GITHUB_REDIRECT_URIも環境変数として必要です
}

/**
 * GitHub OAuthアクセストークンAPIからのレスポンスの型定義。
 */
export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string; // refresh_tokenはオプション
  refresh_token_expires_in?: number;
}
