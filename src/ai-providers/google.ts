import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { BaseAIProvider } from "./base-provider.js";

export class GoogleAIProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Google";
  }

  getRequiredApiKeyName(): string {
    return "GOOGLE_API_KEY";
  }

  getClient(params: any) {
    const { apiKey } = params;
    if (!apiKey) {
      throw new Error("Google API key is required.");
    }

    return createGoogleGenerativeAI({ apiKey });
  }
}

