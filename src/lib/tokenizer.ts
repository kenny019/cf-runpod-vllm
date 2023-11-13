import { PROMPT_FORMAT } from "../contants";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export default class Tokenizer {
  private format: (typeof PROMPT_FORMAT)[keyof typeof PROMPT_FORMAT];
  private promptMessages: Message[];
  private parsedPrompt = "";

  constructor(messages: Message[], model: keyof typeof PROMPT_FORMAT) {
    if (!messages || messages.length < 1) {
      throw new Error("invalid messages for tokenizer");
    }

    this.format = PROMPT_FORMAT[model];
    this.promptMessages = messages;
    this.parsedPrompt = this.parseMessages();
  }

  private parseMessages() {
    switch (this.format) {
      case "vicuna": {
        return (
          this.promptMessages.reduce((acc, message) => {
            if (message.role === "system") {
              acc += `${message.content}`;
            } else {
              acc += `${message.role.toUpperCase()}: ${message.content}`;
              if (message.role === "assistant") {
                acc += "</s>";
              }
            }

            acc += " ";
            return acc;
          }, "") + "ASSISTANT: "
        ).trim();
      }
      case "llama2": {
        return (
          this.promptMessages.reduce((acc, message) => {
            if (message.role === "system") {
              acc += `[INST] <<SYS>> ${message.content}\n<</SYS>>`;
            } else {
              acc += `${message.role.toUpperCase()}: ${
                message.content
              } [/INST]`;
              if (message.role === "assistant") {
                acc += "</s><s>[INST]";
              }
            }

            acc += " ";
            return acc;
          }, "") + "ASSISTANT: "
        ).trim();
      }
      default: {
        throw new Error("invalid format");
      }
    }
  }

  async tokenize() {
    await this.parseMessages();
    return this.parsedPrompt;
  }
}
