import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import LLM from "../lib/llm";
import Tokenizer from "../lib/tokenizer";
import { ENDPOINTS, PROMPT_FORMAT } from "../contants";

const chat = new Hono();

const completionBodySchema = z.object({
  model: z.string(),
  messages: z
    .object({
      role: z.union([
        z.literal("system"),
        z.literal("user"),
        z.literal("assistant"),
      ]),
      content: z.string(),
    })
    .array(),
  max_tokens: z.number().optional().default(200),
  presence_penalty: z.number().min(-2).max(2).optional().default(0),
  stop: z
    .string()
    .or(z.string().array().optional())
    .optional()
    .default(["USER", "</s>"]),
  stream: z.boolean().optional().default(true),
  temperature: z.number().optional().default(1),
  top_p: z.number().optional().default(1),
  top_k: z.number().optional().default(-1),
  frequency_penalty: z.number().optional().default(0),
});

chat.post(
  "/completions",
  zValidator("json", completionBodySchema),
  async (ctx) => {
    const data = ctx.req.valid("json");
    const {
      model,
      messages,
      presence_penalty,
      temperature,
      top_p,
      stop,
      max_tokens,
      frequency_penalty,
      top_k,
    } = data;

    if (!Object.keys(ENDPOINTS).includes(model)) {
      return ctx.json({
        success: false,
        error: "invalid model",
      });
    }

    const selectedModel = model as keyof typeof PROMPT_FORMAT;
    const tokenizer = new Tokenizer(messages, selectedModel);
    const prompt = await tokenizer.tokenize();

    return ctx.streamText(async (stream) => {
      console.log("start job");
      const llm = new LLM(prompt, stream, selectedModel);
      await llm.send({
        frequency_penalty,
        top_k,
        presence_penalty,
        max_tokens,
        temperature,
        top_p,
        stop,
      });
    });
  }
);

export { chat };
