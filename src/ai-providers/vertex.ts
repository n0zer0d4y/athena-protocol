import { createVertex } from "@ai-sdk/google-vertex";
import { BaseAIProvider } from "./base-provider.js";

export class VertexProvider extends BaseAIProvider {
  constructor() {
    super();
    this.name = "Vertex";
  }

  getRequiredApiKeyName() {
    return "VERTEX_API_KEY";
  }

  getClient(params: { apiKey: string; projectId?: string; region?: string }) {
    const { apiKey, projectId, region } = params;
    if (!apiKey) {
      throw new Error("Vertex API key is required.");
    }
    if (!projectId) {
      throw new Error("Vertex project ID is required.");
    }

    return createVertex({
      project: projectId,
      location: region || "us-central1", // Default to us-central1
    });
  }
}
