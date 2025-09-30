import { createMistral } from "@ai-sdk/mistral";
import { BaseAIProvider } from "./base-provider.js";

export class MistralProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Mistral";
  }

  getRequiredApiKeyName() {
    return "MISTRAL_API_KEY";
  }

  getClient(params: { apiKey: string }) {
    const { apiKey } = params;
    if (!apiKey) {
      throw new Error("Mistral API key is required.");
    }
    return createMistral({ apiKey });
  }
}

