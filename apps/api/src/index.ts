import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1"; // DB実装を有効化
import * as schema from "../drizzle/schema"; // DB実装を有効化

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
    userId: string | null;
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
    origin: ["chrome-extension://imjikfcieomhjalhflkgmkkafnenkpeo"],
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type"],
    credentials: true, // すべてのリクエストでCookie→userIdを載せる(c.get("userId")で参照可)
  }),
);

// ミドルウェア: リクエストごとにDBインスタンスを生成 (有効化)
// AppContextのBindingsにDBプロパティがあることを前提とします。
app.use("*", async (c, next) => {
  // c.env.DBが存在するか確認し、Drizzleインスタンスを生成
  if (c.env.DB) {
    const db = drizzle(c.env.DB, { schema });
    c.set("db", db);
    c.set("userId", getCookie(c, "prism_uid") || null);
  } else {
    // DBが利用できない場合のログまたはエラーハンドリング
    console.warn("D1 Database (c.env.DB) is not available.");
  }
  await next();
});

// ルートパス ("/") の変更
// アプリケーションのルートURLにアクセスした際に、GitHub認証を開始するためのHTMLを返します。
// GitHub認証関連のルートを登録
app.route("/github", githubRouter);

app.route("/", conversations);

app.route("/ws", websocket); // 既存のwebsocketルーターの登録

export default app;
