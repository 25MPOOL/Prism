import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../drizzle/schema";

//環境変数の型定義
type Env = CloudflareBindings;

//Drizzleインスタンスの型
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

//Honoのコンテキスト型
type AppContext = {
  Bindings: Env;
  Variables: {
    db: DrizzleDB;
  };
};

const app = new Hono<AppContext>();

// ミドルウェア: リクエストごとにDBインスタンスを生成
app.use("*", async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("db", db);
  await next();
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// テスト用エンドポイント: conversationを取得
app.get("/conversations", async (c) => {
  const db = c.get("db");
  const conversations = await db.select().from(schema.conversations);
  return c.json(conversations);
});

export default app;
