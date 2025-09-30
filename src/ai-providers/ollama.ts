import { createOllama } from "ollama-ai-provider";
import { BaseAIProvider } from "./base-provider.js";

export class OllamaProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Ollama";
  }

  isRequiredApiKey() {
    return false; // Ollama typically doesn't require an API key for local usage
  }

  getRequiredApiKeyName() {
    return "OLLAMA_API_KEY"; // Optional for authentication
  }

  getClient(params: { apiKey?: string; baseURL?: string }) {
    const { apiKey, baseURL } = params;

    const config: any = {};
    if (baseURL) {
      config.baseURL = baseURL;
    }
    if (apiKey) {
      config.apiKey = apiKey;
    }

    return createOllama(config);
  }
}

