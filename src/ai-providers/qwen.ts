import { createOpenAI } from "@ai-sdk/openai";
import { BaseAIProvider } from "./base-provider.js";

export class QwenProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Qwen";
  }

  getRequiredApiKeyName(): string {
    return "QWEN_API_KEY";
  }

  getClient(params: any) {
    const { apiKey } = params;
    if (!apiKey) {
      throw new Error("Qwen API key is required.");
    }

    // Use OpenAI-compatible client with DashScope base URL for Qwen
    return createOpenAI({
      apiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
  }
}

