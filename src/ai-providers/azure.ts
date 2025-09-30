import { createAzure } from "@ai-sdk/azure";
import { BaseAIProvider } from "./base-provider.js";

export class AzureProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Azure";
  }

  getRequiredApiKeyName() {
    return "AZURE_API_KEY";
  }

  getClient(params: { apiKey: string; baseURL?: string; apiVersion?: string }) {
    const { apiKey, baseURL, apiVersion } = params;
    if (!apiKey) {
      throw new Error("Azure API key is required.");
    }
    if (!baseURL) {
      throw new Error("Azure endpoint/baseURL is required.");
    }

    return createAzure({
      apiKey,
      baseURL,
      apiVersion: apiVersion || "2024-02-01", // Default to latest stable version
    });
  }
}

