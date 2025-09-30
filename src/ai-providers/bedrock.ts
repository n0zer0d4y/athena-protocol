import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { BaseAIProvider } from "./base-provider.js";

export class BedrockProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Bedrock";
  }

  getRequiredApiKeyName() {
    return "BEDROCK_API_KEY";
  }

  getClient(params: { apiKey?: string; region?: string }) {
    const { apiKey, region } = params;

    return createAmazonBedrock({
      region: region || "us-east-1", // Default to us-east-1
      // Bedrock uses AWS credentials, not API keys
      // The apiKey parameter is kept for interface consistency
    });
  }
}

