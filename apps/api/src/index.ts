import { Hono } from "hono";
import { cors } from "hono/cors";
import { conversations } from "./routes/conversation";
import { websocket } from "./routes/websocket";
import githubRouter from "./routes/github";
import type { AppEnv } from "./types/definitions";

// HonoのインスタンスにAppEnv型を適用
const app = new Hono<{ Bindings: AppEnv }>();

/**
 * CORS 設定
 * Chrome拡張機能からのアクセスを許可します。
 */
app.use(
  "/*",
  cors({
    origin: "chrome-extension://iehakmnooonopdcffjcibndgidphpanc",
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type"],
  }),
);

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
        </div>
      </body>
    </html>
  `);
});

// GitHub認証関連のルートを登録
// これにより、/github/oauth や /github/callback のようなパスでアクセスできるようになります。
app.route("/github", githubRouter);

app.route("/", conversations);

app.route("/ws", websocket);

export default app;
