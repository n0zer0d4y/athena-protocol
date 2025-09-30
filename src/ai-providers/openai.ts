import { createOpenAI } from "@ai-sdk/openai";
import { BaseAIProvider } from "./base-provider.js";
import { isGPT5Model } from "../config-manager.js";

export class OpenAIProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "OpenAI";
  }

  getRequiredApiKeyName(): string {
    return "OPENAI_API_KEY";
  }

  getClient(params: any) {
    const { apiKey, baseURL } = params;
    if (!apiKey) {
      throw new Error("OpenAI API key is required.");
    }

    return createOpenAI({
      apiKey,
      ...(baseURL && { baseURL }),
    });
  }

  // Handle GPT-5 specific parameters using centralized detection
  prepareTokenParam(modelId: string, maxTokens?: number) {
    if (maxTokens === undefined) return {};

    const tokenValue = Math.floor(Number(maxTokens));

    // Use centralized GPT-5 detection
    if (isGPT5Model(modelId)) {
      return { max_completion_tokens: tokenValue };
    } else {
      return { maxTokens: tokenValue };
    }
  }

  // Override to handle GPT-5 specific model requirements using centralized detection
  requiresMaxCompletionTokens(modelId: string): boolean {
    return isGPT5Model(modelId);
  }
}
