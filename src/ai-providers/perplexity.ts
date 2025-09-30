import { createPerplexity } from "@ai-sdk/perplexity";
import { BaseAIProvider } from "./base-provider.js";

export class PerplexityProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Perplexity";
  }

  getRequiredApiKeyName() {
    return "PERPLEXITY_API_KEY";
  }

  getClient(params: { apiKey: string }) {
    const { apiKey } = params;
    if (!apiKey) {
      throw new Error("Perplexity API key is required.");
    }
    return createPerplexity({ apiKey });
  }
}

