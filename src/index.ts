import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { models } from "./routes/models";
import { chat } from "./routes/chat";
import { SECRET_TOKEN } from './contants';

const app = new Hono();

app.use(
  "/v1/*",
  bearerAuth({
    token: SECRET_TOKEN, // bearer token
  })
);

app.get("/", (ctx) => ctx.text("runpod cloudflare api"));

app.route("/v1/models", models);
app.route("/v1/chat", chat);

export default app;
