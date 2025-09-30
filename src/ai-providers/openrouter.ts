import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { BaseAIProvider } from "./base-provider.js";

export class OpenRouterAIProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "OpenRouter";
  }

  getRequiredApiKeyName(): string {
    return "OPENROUTER_API_KEY";
  }

  getClient(params: any) {
    const { apiKey } = params;
    if (!apiKey) {
      throw new Error("OpenRouter API key is required.");
    }

    return createOpenRouter({
      apiKey,
      // Note: OpenRouter doesn't support custom headers in this SDK version
    });
  }
}
