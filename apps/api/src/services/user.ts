import { eq, and, isNotNull } from "drizzle-orm"; // isNotNull もインポート
import { users, githubTokens } from "../../drizzle/schema"; // usersとgithubTokensテーブルを直接インポート
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../../drizzle/schema";
import type { GitHubTokenResponse } from "../types/github"; // GitHub関連の型をインポート
import { refreshGitHubAccessToken } from "./github/auth"; // refreshGitHubAccessToken をインポート

/**
 * GitHubユーザーIDに基づいてユーザーを検索し、存在しない場合は新しく作成する関数。
 * @param db Drizzleデータベースインスタンス
 * @param githubId GitHubユーザーのユニークな数値ID
 * @param githubUsername GitHubユーザー名
 * @returns ユーザーレコード
 */
export async function findOrCreateUser(
  db: DrizzleD1Database<typeof schema>,
  githubId: number,
  githubUsername: string,
): Promise<typeof users.$inferSelect> {
  // 既存ユーザーを検索
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.githubId, githubId))
    .limit(1);

  if (existingUsers.length > 0) {
    // ユーザーが存在する場合、ユーザー名を更新して返す
    const [updatedUser] = await db
      .update(users)
      .set({
        githubUsername: githubUsername,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.githubId, githubId))
      .returning();
    if (!updatedUser) throw new Error("Failed to update existing user.");
    return updatedUser;
  } else {
    // ユーザーが存在しない場合、新規作成
    const [newUser] = await db
      .insert(users)
      .values({
        githubId: githubId,
        githubUsername: githubUsername,
      })
      .returning();
    if (!newUser) throw new Error("Failed to create new user.");
    return newUser;
  }
}

/**
 * ユーザーのGitHubトークンをデータベースに保存または更新する関数。
 * @param db Drizzleデータベースインスタンス
 * @param userId Prism内部のユーザーID
 * @param tokens GitHubトークンレスポンス
 */
export async function saveGitHubTokens(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  tokens: GitHubTokenResponse,
): Promise<void> {
  // アクセストークンの有効期限を計算 (現在時刻 + expiresIn秒)
  const accessTokenExpiresAt =
    Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600); // デフォルト1時間

  // 既存のトークンレコードを検索 (userIdはユニークインデックスなので1つだけ)
  const existingTokens = await db
    .select()
    .from(githubTokens)
    .where(eq(githubTokens.userId, userId))
    .limit(1);

  if (existingTokens.length > 0) {
    // 既存のトークンがある場合、更新
    await db
      .update(githubTokens)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existingTokens[0]?.refreshToken,
        accessTokenExpiresAt: accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refresh_token_expires_in
          ? Math.floor(Date.now() / 1000) + tokens.refresh_token_expires_in
          : existingTokens[0]?.refreshTokenExpiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(githubTokens.userId, userId));
  } else {
    // 既存のトークンがない場合、新規挿入
    if (!tokens.refresh_token) {
      throw new Error(
        "refresh_token is required for new githubTokens insert, but was not provided.",
      );
    }
    await db.insert(githubTokens).values({
      userId: userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refresh_token_expires_in
        ? Math.floor(Date.now() / 1000) + tokens.refresh_token_expires_in
        : undefined,
    });
  }
}

/**
 * 指定されたPrismユーザーIDのGitHubトークン情報をデータベースから取得する関数。
 * @param db Drizzleデータベースインスタンス
 * @param userId Prism内部のユーザーID
 * @returns GitHubトークンレコード、またはnull
 */
export async function getGitHubTokensForUser(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
): Promise<typeof githubTokens.$inferSelect | null> {
  try {
    const tokens = await db
      .select()
      .from(githubTokens)
      .where(eq(githubTokens.userId, userId))
      .limit(1);

    if (tokens.length > 0) {
      return tokens[0];
    }
    return null;
  } catch (error) {
    console.error(`Error getting GitHub tokens for user ${userId}:`, error);
    return null;
  }
}

/**
 * 指定されたPrismユーザーIDがGitHubと連携済みかどうかをチェックする関数。
 * 有効なGitHubトークンがデータベースに存在するかどうかで判断します。
 * @param db Drizzleデータベースインスタンス
 * @param userId Prism内部のユーザーID
 * @returns 連携済みであればtrue、そうでなければfalse
 */
export async function isUserGitHubLinked(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
): Promise<boolean> {
  try {
    const linkedUser = await db
      .select()
      .from(users)
      .leftJoin(githubTokens, eq(users.id, githubTokens.userId)) // usersとgithubTokensを結合
      .where(
        and(
          // users.idとgithubTokens.userIdが一致し、かつ
          eq(users.id, userId), // 指定されたuserIdに一致し、かつ
          isNotNull(githubTokens.accessToken), // githubTokensのaccessTokenが存在する (isNotNullを使用)
        ),
      )
      .limit(1);

    return linkedUser.length > 0; // 結果があれば連携済み
  } catch (error) {
    console.error(
      `Error checking GitHub link status for user ${userId}:`,
      error,
    );
    return false; // エラー時は未連携とみなす
  }
}

/**
 * 指定されたPrismユーザーIDに対して有効なGitHubアクセストークンを取得する関数。
 * トークンが期限切れの場合、自動的にリフレッシュを試みます。
 * @param db Drizzleデータベースインスタンス
 * @param userId Prism内部のユーザーID
 * @param clientId GitHub AppのクライアントID
 * @param clientSecret GitHub Appのクライアントシークレット
 * @returns 有効なアクセストークン、またはnull（取得・リフレッシュ失敗時）
 */
export async function getValidGitHubAccessToken(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const tokenRecord = await getGitHubTokensForUser(db, userId);

  if (!tokenRecord) {
    console.warn(`No GitHub token record found for user ${userId}.`);
    return null;
  }

  // アクセストークンの有効期限が切れているかチェック
  // 現在時刻 (秒) が有効期限 (秒) を超えているか
  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const isAccessTokenExpired =
    tokenRecord.accessTokenExpiresAt <= currentTimeInSeconds;

  if (!isAccessTokenExpired) {
    // アクセストークンが有効であればそのまま返す
    return tokenRecord.accessToken;
  }

  // アクセストークンが期限切れの場合、リフレッシュを試みる
  if (!tokenRecord.refreshToken) {
    console.error(
      `Access token expired for user ${userId}, but no refresh token available.`,
    );
    return null;
  }

  console.log(
    `Access token expired for user ${userId}. Attempting to refresh...`,
  );
  const newTokens = await refreshGitHubAccessToken(
    tokenRecord.refreshToken,
    clientId,
    clientSecret,
  );

  if (newTokens?.access_token) {
    // 新しいトークンが取得できたらデータベースを更新
    await saveGitHubTokens(db, userId, newTokens); // saveGitHubTokensはupsertロジックを持つため、更新も可能
    console.log(`Access token refreshed and saved for user ${userId}.`);
    return newTokens.access_token;
  } else {
    console.error(
      `Failed to refresh access token for user ${userId}. User may need to re-authenticate.`,
    );
    return null;
  }
}
