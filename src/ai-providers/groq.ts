import { createGroq } from "@ai-sdk/groq";
import { BaseAIProvider } from "./base-provider.js";

export class GroqProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Groq";
  }

  getRequiredApiKeyName(): string {
    return "GROQ_API_KEY";
  }

  getClient(params: any) {
    const { apiKey } = params;
    if (!apiKey) {
      throw new Error("Groq API key is required.");
    }

    return createGroq({ apiKey });
  }
}

