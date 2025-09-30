// Provider registry - centralized exports for all AI providers
export { BaseAIProvider } from "./base-provider.js";
export { AnthropicAIProvider } from "./anthropic.js";
export { GoogleAIProvider } from "./google.js";
export { OpenAIProvider } from "./openai.js";
export { OpenRouterAIProvider } from "./openrouter.js";
export { QwenProvider } from "./qwen.js";
export { GroqProvider } from "./groq.js";
export { XAIProvider } from "./xai.js";
export { MistralProvider } from "./mistral.js";
export { PerplexityProvider } from "./perplexity.js";
export { OllamaProvider } from "./ollama.js";
export { ZAIProvider } from "./zai.js";
export { AzureProvider } from "./azure.js";
export { BedrockProvider } from "./bedrock.js";
export { VertexProvider } from "./vertex.js";

// Provider class mapping for dynamic instantiation
export const PROVIDER_CLASSES = {
  anthropic: () => import("./anthropic.js").then((m) => m.AnthropicAIProvider),
  google: () => import("./google.js").then((m) => m.GoogleAIProvider),
  openai: () => import("./openai.js").then((m) => m.OpenAIProvider),
  openrouter: () =>
    import("./openrouter.js").then((m) => m.OpenRouterAIProvider),
  qwen: () => import("./qwen.js").then((m) => m.QwenProvider),
  groq: () => import("./groq.js").then((m) => m.GroqProvider),
  xai: () => import("./xai.js").then((m) => m.XAIProvider),
  mistral: () => import("./mistral.js").then((m) => m.MistralProvider),
  perplexity: () => import("./perplexity.js").then((m) => m.PerplexityProvider),
  ollama: () => import("./ollama.js").then((m) => m.OllamaProvider),
  zai: () => import("./zai.js").then((m) => m.ZAIProvider),
  azure: () => import("./azure.js").then((m) => m.AzureProvider),
  bedrock: () => import("./bedrock.js").then((m) => m.BedrockProvider),
  vertex: () => import("./vertex.js").then((m) => m.VertexProvider),
};

// List of all supported providers
export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_CLASSES);

// Provider configuration keys mapping
export const PROVIDER_API_KEYS = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  qwen: "QWEN_API_KEY",
  groq: "GROQ_API_KEY",
  xai: "XAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  ollama: "OLLAMA_API_KEY",
  zai: "ZAI_API_KEY",
  azure: "AZURE_API_KEY",
  bedrock: "BEDROCK_API_KEY",
  vertex: "VERTEX_API_KEY",
};

// ==========================================
// PROVIDER FEATURES AND CAPABILITIES
// ==========================================

/**
 * Provider type for type safety
 */
export type SupportedProvider = keyof typeof PROVIDER_CLASSES;

/**
 * Provider feature definitions - replace hardcoded provider checks
 */
export const PROVIDER_FEATURES = {
  // Providers with GPT-5/reasoning model support
  GPT5_REASONING: ["openai"] as const,

  // Providers with streaming support
  STREAMING: [
    "anthropic",
    "openai",
    "google",
    "groq",
    "xai",
    "openrouter",
    "qwen",
    "mistral",
    "perplexity",
    "ollama",
  ] as const,

  // Providers with function calling
  FUNCTION_CALLING: [
    "anthropic",
    "openai",
    "google",
    "groq",
    "xai",
    "openrouter",
  ] as const,

  // Providers with advanced reasoning capabilities
  ADVANCED_REASONING: ["anthropic", "openai", "google"] as const,

  // Providers that support custom parameters
  CUSTOM_PARAMETERS: ["openai", "anthropic"] as const,
} as const;

/**
 * Check if provider supports a specific feature
 */
export function providerSupportsFeature(
  provider: string,
  feature: keyof typeof PROVIDER_FEATURES
): boolean {
  const supportedProviders = PROVIDER_FEATURES[feature];
  return supportedProviders.includes(provider as any);
}

/**
 * Get providers that support a specific feature
 */
export function getProvidersWithFeature(
  feature: keyof typeof PROVIDER_FEATURES
): readonly string[] {
  return PROVIDER_FEATURES[feature];
}

/**
 * Get all features supported by a provider
 */
export function getProviderFeatures(provider: string): string[] {
  const features: string[] = [];
  for (const [feature, providers] of Object.entries(PROVIDER_FEATURES)) {
    if (providers.includes(provider as any)) {
      features.push(feature);
    }
  }
  return features;
}
