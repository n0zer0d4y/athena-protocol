import { createXai } from "@ai-sdk/xai";
import { BaseAIProvider } from "./base-provider.js";

export class XAIProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "XAI";
  }

  getRequiredApiKeyName(): string {
    return "XAI_API_KEY";
  }

  getClient(params: any) {
    const { apiKey } = params;
    if (!apiKey) {
      throw new Error("XAI API key is required.");
    }

    return createXai({ apiKey });
  }
}

