import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1"; // DB実装を有効化
import * as schema from "../drizzle/schema"; // DB実装を有効化
import { eq } from "drizzle-orm";

import { conversations } from "./routes/conversation";
import { websocket } from "./routes/websocket"; // 既存のwebsocketルーター
import githubRouter from "./routes/github";
import type { AppEnv } from "./types/definitions";

// DrizzleDBの型定義を再度有効化します
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

// AppContextのVariablesにdbプロパティを追加します
// types/definitions.tsのAppContextをこの形式に合わせる必要があります。
// もしtypes/definitions.tsのAppContextがinterface AppContext { Bindings: AppEnv; } の形であれば、
// interface AppContext { Bindings: AppEnv; Variables: { db: DrizzleDB; }; } に更新してください。
export interface AppContext {
  Bindings: AppEnv;
  Variables: {
    db: DrizzleDB;
  };
}

// HonoのインスタンスにAppContext型を適用
const app = new Hono<AppContext>();

/**
 * CORS 設定
 * Chrome拡張機能からのアクセスを許可します。
 */
app.use(
  "/*",
  cors({
    origin: "chrome-extension://iehakmnooonopdcffjcibndgidphpanc", // Prism ExtensionのID
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type"],
  }),
);

// ミドルウェア: リクエストごとにDBインスタンスを生成 (有効化)
// AppContextのBindingsにDBプロパティがあることを前提とします。
app.use("*", async (c, next) => {
  // c.env.DBが存在するか確認し、Drizzleインスタンスを生成
  if (c.env.DB) {
    const db = drizzle(c.env.DB, { schema });
    c.set("db", db);
  } else {
    // DBが利用できない場合のログまたはエラーハンドリング
    console.warn("D1 Database (c.env.DB) is not available.");
  }
  await next();
});

// ルートパス ("/") の変更
// アプリケーションのルートURLにアクセスした際に、GitHub認証を開始するためのHTMLを返します。
app.get("/", (c) => {
  return c.html(`
    <html lang="ja">
      <head>
        <title>Prism GitHub認証</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { font-family: 'Inter', sans-serif; }
        </style>
      </head>
      <body class="bg-gray-900 text-white min-h-screen flex items-center justify-center p-4">
        <div class="bg-gray-800 shadow-lg p-8 max-w-md w-full text-center rounded-xl">
          <h1 class="text-3xl font-bold mb-4 text-indigo-400">Prism GitHub認証テスト</h1>
          <p class="text-lg mb-6 text-gray-300">GitHubアカウントとの連携を開始します。</p>
          <a href="/github/oauth" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 transform hover:scale-105 inline-block">
            GitHubで認証を開始する
          </a>
          <div class="mt-8 text-gray-400">
            <p>DBテスト用エンドポイント:</p>
            <p><code class="bg-gray-700 p-1 rounded">/db/test-user</code></p>
          </div>
        </div>
      </body>
    </html>
  `);
});

// GitHub認証関連のルートを登録
app.route("/github", githubRouter);

app.route("/", conversations);

app.route("/ws", websocket); // 既存のwebsocketルーターの登録

// 新規追加: DBテスト用エンドポイント
app.get("/db/test-user", async (c) => {
  const db = c.get("db"); // ミドルウェアで設定されたDBインスタンスを取得

  if (!db) {
    return c.text(
      "Database not initialized. Check your D1 binding in wrangler.jsonc or .env.",
      500,
    );
  }

  try {
    // 1. users テーブルにデータを挿入 (または既存ユーザーを更新)
    const testGithubId = 123456789; // テスト用のGitHub ID
    const testGithubUsername = "testuser_prism"; // テスト用のユーザー名

    // upsert (挿入または更新) のロジック
    // まず既存ユーザーを検索
    const existingUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.githubId, testGithubId))
      .limit(1);
    let user: typeof schema.users.$inferSelect;

    if (existingUsers.length > 0) {
      // ユーザーが存在する場合、更新
      const [updated] = await db
        .update(schema.users)
        .set({
          githubUsername: testGithubUsername,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.users.githubId, testGithubId))
        .returning();
      if (!updated) return c.json({ error: "Update failed" }, 500);
      user = updated;
      console.log("Existing user updated:", user);
    } else {
      // ユーザーが存在しない場合、新規挿入
      const [created] = await db
        .insert(schema.users)
        .values({
          githubId: testGithubId,
          githubUsername: testGithubUsername,
        })
        .returning();
      if (!created) return c.json({ error: "Insert failed" }, 500);
      user = created;
      console.log("New user created:", user);
    }

    // 2. users テーブルからすべてのデータを取得して確認
    const allUsers = await db.select().from(schema.users);
    console.log("All users in DB:", allUsers);

    return c.json({
      message: "DB test successful: User inserted/updated and retrieved.",
      insertedOrUpdatedUser: user,
      allUsersInDb: allUsers,
    });
  } catch (error) {
    console.error("DB test error:", error);
    return c.json(
      {
        error: "Failed to perform DB operations.",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

export default app;
