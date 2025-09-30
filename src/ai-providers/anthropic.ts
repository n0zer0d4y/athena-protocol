import { createAnthropic } from "@ai-sdk/anthropic";
import { BaseAIProvider } from "./base-provider.js";

export class AnthropicAIProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Anthropic";
  }

  getRequiredApiKeyName(): string {
    return "ANTHROPIC_API_KEY";
  }

  getClient(params: any) {
    const { apiKey } = params;
    if (!apiKey) {
      throw new Error("Anthropic API key is required.");
    }

    return createAnthropic({ apiKey });
  }
}

