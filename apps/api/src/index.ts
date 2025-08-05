import { Hono } from "hono";
import { cors } from "hono/cors";
import { conversations } from "./routes/conversation";
import type { AppEnv } from "./types/definitions";

const app = new Hono<AppEnv>();

/**
 * CORS 設定
 */
app.use(
  "/*",
  cors({
    origin: "chrome-extension://iehakmnooonopdcffjcibndgidphpanc",
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.route("/", conversations);

export default app;
