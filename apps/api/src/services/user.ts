import { eq } from "drizzle-orm";
import { users, githubTokens } from "../../drizzle/schema"; // usersとgithubTokensテーブルを直接インポート
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../../drizzle/schema";
import type { GitHubTokenResponse } from "../types/github"; // GitHub関連の型をインポート

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
        refreshToken: tokens.refresh_token || existingTokens[0].refreshToken, // リフレッシュトークンが提供されない場合は既存のものを維持
        accessTokenExpiresAt: accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refresh_token_expires_in
          ? Math.floor(Date.now() / 1000) + tokens.refresh_token_expires_in
          : existingTokens[0].refreshTokenExpiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(githubTokens.userId, userId));
  } else {
    // 既存のトークンがない場合、新規挿入
    await db.insert(githubTokens).values({
      userId: userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || "", // refreshTokenが必須の場合、nullish coalescingは使えないので注意
      accessTokenExpiresAt: accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refresh_token_expires_in
        ? Math.floor(Date.now() / 1000) + tokens.refresh_token_expires_in
        : undefined,
    });
  }
}
