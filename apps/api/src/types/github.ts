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
  expires_in?: number;
  refresh_token?: string; // refresh_tokenはオプション
  refresh_token_expires_in?: number;
}

/**
 * GitHubユーザープロファイルAPI (/user) からのレスポンスの型定義。
 */
export interface GitHubUserProfile {
  id: number; // GitHubユーザーのユニークな数値ID
  login: string; // GitHubユーザー名
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/**
 * GitHubのリポジトリ（/user/repos など）レスポンスの主要フィールド。
 * 参照: https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-the-authenticated-user
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
  };
  html_url: string;
  description: string | null;
  default_branch: string;
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
  };
}
