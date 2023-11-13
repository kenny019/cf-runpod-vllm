import { Hono } from "hono";
import { ENDPOINTS } from "../contants";

const models = new Hono();

models.get("/", async (ctx) => {
  const models = Object.keys(ENDPOINTS).map((model) => {
    return {
      object: "list",
      data: [
        {
          id: model,
          object: "model",
          created: 169712718265,
          owned_by: "admin",
        },
      ],
    };
  });

  return ctx.json(models);
});

models.get("/:model", (ctx) => {
  const model = ctx.req.param("model");

  if (!Object.keys(ENDPOINTS).includes(model)) {
    return ctx.notFound();
  }

  return ctx.json({
    id: model,
    object: "model",
    created: 169712718265,
    owned_by: "admin",
  });
});

export { models };
