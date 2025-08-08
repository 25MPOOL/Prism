import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm"; // sql と relations をインポート

// ユーザー情報を保存するテーブル
export const users = sqliteTable("users", {
  id: text("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()), // Prism内部でユーザーを識別するUUID
  githubId: integer("github_id").notNull().unique(), // GitHubから取得するユーザーのユニークなID
  githubUsername: text("github_username").notNull(), // GitHubユーザー名
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), // 作成日時
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`), // 更新日時
});

// githubTokens テーブルの定義
export const githubTokens = sqliteTable(
  "github_tokens",
  {
    id: text("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()), // トークンレコードのUUID
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // users.idへの外部キー
    accessToken: text("access_token").notNull(), // GitHub API呼び出し用トークン
    refreshToken: text("refresh_token"), // アクセストークン更新用トークン（nullableに変更）
    accessTokenExpiresAt: integer("access_token_expires_at").notNull(), // アクセストークンの有効期限 (UNIXタイムスタンプ秒)
    refreshTokenExpiresAt: integer("refresh_token_expires_at"), // リフレッシュトークンの有効期限 (UNIXタイムスタンプ秒, オプション)
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), // 作成日時
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`), // 更新日時
  },
  (table) => [
    // 配列形式に変更（新しいDrizzle ORMの形式）
    uniqueIndex("user_id_idx").on(table.userId),
  ],
);

// 対話のセッション情報を保存するテーブル (既存の定義にuserIdとcreatedAtの修正)
export const conversations = sqliteTable("conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  phase: text("phase", { enum: ["idea", "requirements", "tasks"] })
    .notNull()
    .default("idea"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
});

// 対話メッセージを保存するテーブル (既存の定義にcreatedAtの修正)
export const messages = sqliteTable("messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "ai"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
});

// --- テーブル間のリレーションシップ定義 ---

// users テーブルのリレーション
export const usersRelations = relations(users, ({ one, many }) => ({
  // 1ユーザーは1つのGitHubトークンセットを持つ (one)
  githubTokens: one(githubTokens, {
    fields: [users.id],
    references: [githubTokens.userId],
  }),
  // 1ユーザーは複数の会話を持つ (many)
  conversations: many(conversations),
}));

// githubTokens テーブルのリレーション
export const githubTokensRelations = relations(githubTokens, ({ one }) => ({
  // 1つのトークンセットは1人のユーザーに属する (one)
  user: one(users, {
    fields: [githubTokens.userId],
    references: [users.id],
  }),
}));

// conversations テーブルのリレーション
export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    // 1つの会話は1人のユーザーに属する (one)
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    // 1つの会話は複数のメッセージを持つ (many)
    messages: many(messages),
  }),
);

// messages テーブルのリレーション
export const messagesRelations = relations(messages, ({ one }) => ({
  // 1つのメッセージは1つの会話に属する (one)
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
