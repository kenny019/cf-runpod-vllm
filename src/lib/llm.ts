import { StreamingApi } from "hono/utils/stream";
import { z } from "zod";
import { ENDPOINTS, RUNPOD_TOKEN } from "../contants";

export type SamplingParams = {
  presence_penalty: number;
  frequency_penalty: number;
  temperature: number;
  top_p: number;
  top_k: number;
  stop?: string[] | string;
  ignore_eos?: boolean;
  max_tokens: number;
  skip_special_tokens?: boolean;
};

const RunpodStatusSchema = z.union([
  z.literal("IN_QUEUE"),
  z.literal("IN_PROGRESS"),
  z.literal("FAILED"),
  z.literal("COMPLETED"),
]);

const RunpodResponseSchema = z.object({
  id: z.string(),
  status: RunpodStatusSchema,
});

const RunpodStreamResponseSchema = z.object({
  status: RunpodStatusSchema,
  stream: z.array(
    z.object({
      metrics: z.object({
        stream_index: z.number(),
      }),
      output: z.object({
        input_tokens: z.number(),
        text: z.array(z.string()).or(z.tuple([])),
      }),
    })
  ),
});

type SuccessJob = {
  success: true;
  error?: undefined;
  data: z.infer<typeof RunpodResponseSchema>;
};

type FailedJob = {
  success: false;
  error: unknown;
  data?: undefined;
};

type AvailableModels = keyof typeof ENDPOINTS;

export default class LLM {
  private prompt = "";
  private stream: StreamingApi;
  private timestamp: number;
  private model: AvailableModels;
  private url: string;

  constructor(prompt: string, stream: StreamingApi, model: AvailableModels) {
    if (!prompt || prompt.length < 1) {
      throw new Error("invalid prompt");
    }

    if (!stream) {
      throw new Error("invalid stream");
    }

    if (!model) {
      throw new Error("invalid model");
    }

    this.stream = stream;
    this.prompt = prompt;

    this.model = model;
    this.url = ENDPOINTS[model];
    this.timestamp = Math.floor(Date.now() / 1000);
  }

  // todo: add cancel job
  private async startJob(
    params: SamplingParams
  ): Promise<FailedJob | SuccessJob> {
    const body = {
      input: {
        prompt: this.prompt,
        sampling_params: params,
      },
    };

    console.log(
      "sampling_params",
      JSON.stringify(body.input.sampling_params, null, 2)
    );

    try {
      const response = await fetch(`${this.url}/run`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${RUNPOD_TOKEN}`,
        },
      });

      if (response.status >= 300) {
        return {
          success: false,
          error: `Error ${response.status}`,
        };
      }

      const result = await response.json();
      const runpodResponse = RunpodResponseSchema.safeParse(result);

      if (!runpodResponse.success) {
        return {
          success: false,
          error: `Error Runpod data: ${runpodResponse.error}`,
        };
      }

      return {
        success: true,
        data: runpodResponse.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error,
      };
    }
  }

  private async streamJob(id: string): Promise<void> {
    if (!this.stream) throw new Error("stream is not initialized");

    let jobHasEnded = false;

    while (!jobHasEnded) {
      try {
        const streamResponse = await fetch(`${this.url}/stream/${id}`, {
          headers: {
            Authorization: `Bearer ${RUNPOD_TOKEN}`,
          },
        });

        if (streamResponse.status >= 300) {
          console.error("streamFailed status code", streamResponse.status);
          await this.stream.sleep(200);
          break;
        }

        const streamResult = await streamResponse.json();
        const streamResponseData =
          RunpodStreamResponseSchema.safeParse(streamResult);

        if (!streamResponseData.success) {
          console.error(
            "streamFailed response data invalid",
            streamResponseData.error
          );
          await this.stream.sleep(300);
          continue;
        }

        const streamData = streamResponseData.data;
        if (streamData.status === "FAILED") {
          jobHasEnded = true;
          break;
        }

        if (streamData.status === "IN_QUEUE") {
          await this.stream.sleep(200);
          continue;
        }

        if (streamData.status === "COMPLETED") {
          const outputString =
            streamData.stream.reduce((acc, streamObj) => {
              acc += streamObj.output.text;
              return acc;
            }, "") || "";

          const delta =
            outputString.length > 0
              ? Object.assign(
                  {},
                  {
                    content: outputString,
                  }
                )
              : {};

          jobHasEnded = true;

          const stringifiedData = JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created: this.timestamp,
            model: this.model,
            choices: [
              {
                index: 0,
                delta,
                finish_reason: "stop",
              },
            ],
          });

          await this.stream.writeln(`data: ${stringifiedData}\n`);

          break;
        }

        if (streamData.status === "IN_PROGRESS") {
          const outputString =
            streamData.stream.reduce((acc, streamObj) => {
              acc += streamObj.output.text;
              return acc;
            }, "") || "";

          const delta =
            outputString.length > 0
              ? Object.assign(
                  {},
                  {
                    content: outputString,
                  }
                )
              : {};

          const stringifiedData = JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created: this.timestamp,
            model: this.model,
            choices: [
              {
                index: 0,
                delta,
                finish_reason: null,
              },
            ],
          });
          // console.log(outputString);

          await this.stream.writeln(`data: ${stringifiedData}\n`);

          await this.stream.sleep(200);
        }
      } catch (err) {
        console.error("streamFailed", err);
        continue;
      }
    }

    await this.stream.writeln("data: [DONE]\n");
    await this.stream.close();

    console.log("ended stream");
  }

  async send(params: SamplingParams) {
    const startJobRes = await this.startJob(params);

    if (!startJobRes.success) {
      await this.stream.close();
      return;
    }

    const { data } = startJobRes;

    console.log("id:", data.id);
    await this.streamJob(data.id);
  }
}
