import { Hono } from "hono";
import { conversations } from "./routes/conversation";
import type { AppEnv } from "./types/definitions";

const app = new Hono<AppEnv>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.route("/api/conversations", conversations);

export default app;
