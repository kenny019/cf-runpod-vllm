# Cloudflare Runpod VLLM API

An OpenAI api wrapper for the [Runpod vllm docker image](https://github.com/runpod-workers/worker-vllm)

OpenAI api [reference](https://platform.openai.com/docs/api-reference/chat/create)

## Features

- Supports Vicuna and Llama 2 prompt format
- Only supports streaming for now
- Works with SillyTavern as OpenAI proxy

## Installation

Edit src/constants.ts (Recommended to add a SECRET_TOKEN for safety)
Running locally:

```
pnpm install
pnpm run dev
```

Uploading to Cloudflare Worker

```
pnpm run deploy
```
