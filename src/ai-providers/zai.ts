import { createOpenAI } from "@ai-sdk/openai";
import { BaseAIProvider } from "./base-provider.js";

export class ZAIProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "ZAI";
  }

  getRequiredApiKeyName() {
    return "ZAI_API_KEY";
  }

  getClient(params: { apiKey: string; baseURL?: string }) {
    const { apiKey, baseURL } = params;
    if (!apiKey) {
      throw new Error("ZAI API key is required.");
    }

    // ZAI typically uses OpenAI-compatible API
    return createOpenAI({
      apiKey,
      baseURL: baseURL || "https://api.zai.ai/v1", // Default ZAI base URL
    });
  }
}

