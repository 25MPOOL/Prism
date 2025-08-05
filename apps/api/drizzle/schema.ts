import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// 対話のセッション情報を保存するテーブル
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
});

// 対話メッセージを保存するテーブル
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(new Date()),
});
