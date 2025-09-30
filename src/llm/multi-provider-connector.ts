import { BaseAIProvider, PROVIDER_CLASSES } from "../ai-providers/index.js";
import {
  getApiKey,
  getModel,
  getConfiguredProviders,
  getBestAvailableProvider,
  getUnifiedProviderConfig,
} from "../config-manager.js";
import { performanceMonitor } from "../utils/performance-monitor.js";

// Legacy provider interface for backward compatibility
export interface LLMProvider {
  name: string;
  initialize(): Promise<void>;
  generateCompletion(messages: any[], options: any): Promise<any>;
  healthCheck(): Promise<{ status: string; latency?: number; error?: string }>;
  isAvailable(): boolean;
}

// Provider instance cache for the legacy connector
const providerInstanceCache = new Map<string, BaseAIProvider>();

async function getProviderInstance(
  providerName: string
): Promise<BaseAIProvider> {
  const normalizedName = providerName.toLowerCase();

  if (!providerInstanceCache.has(normalizedName)) {
    const ProviderClass = await PROVIDER_CLASSES[
      normalizedName as keyof typeof PROVIDER_CLASSES
    ]();
    const providerInstance = new ProviderClass();
    providerInstanceCache.set(normalizedName, providerInstance);
  }

  return providerInstanceCache.get(normalizedName)!;
}

// Legacy adapter to maintain backward compatibility
class LegacyProviderAdapter implements LLMProvider {
  public name: string;
  private baseProvider: BaseAIProvider;
  private providerName: string;

  constructor(baseProvider: BaseAIProvider) {
    this.providerName = baseProvider.constructor.name
      .replace("Provider", "")
      .toLowerCase();
    this.name = this.providerName;
    this.baseProvider = baseProvider;
  }

  async initialize(): Promise<void> {
    // BaseAIProvider doesn't need explicit initialization
  }

  isAvailable(): boolean {
    const apiKey = getApiKey(this.name);
    const model = getModel(this.name);
    return !!(apiKey && model);
  }

  async generateCompletion(messages: any[], options: any): Promise<any> {
    const apiKey = getApiKey(this.name);
    const modelId = getModel(this.name);

    if (!apiKey || !modelId) {
      throw new Error(`Provider ${this.name} is not properly configured`);
    }

    const operationId = `${this.name}-${modelId}-completion`;
    const tracker = performanceMonitor.startOperation(
      operationId,
      this.name,
      modelId
    );

    try {
      const result = await this.baseProvider.generateText({
        apiKey,
        modelId,
        messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });

      tracker.finish(true);
      return {
        content: result?.text || "",
        usage: result?.usage || {},
        model: modelId,
      };
    } catch (error) {
      tracker.finish(false, (error as Error).message);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    status: string;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const apiKey = getApiKey(this.name);
      const modelId = getModel(this.name);

      if (!apiKey || !modelId) {
        return {
          status: "unhealthy",
          latency: Date.now() - startTime,
          error: "Provider not configured",
        };
      }

      // Perform a minimal test generation
      await this.baseProvider.generateText({
        apiKey,
        modelId,
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 5,
      });

      return {
        status: "healthy",
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latency: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }
}

export class MultiProviderLLMConnector {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string;

  constructor(config: any) {
    this.defaultProvider = this.resolveDefaultProvider(config);

    // Initialize providers based on configuration and available API keys
    this.initializeProviders();
  }

  /**
   * Resolve the default provider with proper fallback logic and backward compatibility
   */
  private resolveDefaultProvider(config: any): string {
    // First priority: explicit config
    if (config.defaultProvider) {
      console.log(
        `Using configured default provider: ${config.defaultProvider}`
      );
      return config.defaultProvider;
    }

    // Second priority: environment-driven best available provider
    const bestAvailable = getBestAvailableProvider();
    if (bestAvailable) {
      console.log(
        `Using best available provider from environment: ${bestAvailable}`
      );
      return bestAvailable;
    }

    // No fallback - fail fast with clear error
    throw new Error(
      "No LLM provider configured. Please set DEFAULT_LLM_PROVIDER in your .env file " +
        "or configure API keys for at least one provider (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)"
    );
  }

  private async initializeProviders(): Promise<void> {
    const configuredProviders = getConfiguredProviders();

    for (const provider of configuredProviders) {
      if (provider.hasApiKey && provider.model) {
        try {
          const baseProvider = await getProviderInstance(provider.name);
          const legacyAdapter = new LegacyProviderAdapter(baseProvider);
          this.providers.set(provider.name, legacyAdapter);
        } catch (error) {
          console.warn(
            `Failed to initialize provider ${provider.name}: ${
              (error as Error).message
            }`
          );
        }
      }
    }

    // Ensure we have at least one provider
    if (this.providers.size === 0) {
      throw new Error(
        "No valid LLM providers found. Please check your API keys and model configurations."
      );
    }
  }

  async initialize(): Promise<void> {
    // Initialize all providers
    const initPromises = Array.from(this.providers.values()).map((provider) =>
      provider.initialize().catch((error) => {
        console.warn(`Failed to initialize ${provider.name}: ${error.message}`);
      })
    );

    await Promise.all(initPromises);
    console.log(
      `Multi-provider LLM connector initialized with ${this.providers.size} providers`
    );
  }

  async generateCompletion(messages: any[], options: any = {}): Promise<any> {
    const providerName = options.provider || this.defaultProvider;
    let provider = this.providers.get(providerName);

    if (!provider) {
      // Fallback to any available provider
      const availableProviders = this.getAvailableProviders();
      if (availableProviders.length > 0) {
        provider = this.providers.get(availableProviders[0]);
        console.warn(
          `Provider ${providerName} not available, using ${availableProviders[0]} instead`
        );
      }
    }

    if (!provider) {
      throw new Error(`No providers available. Requested: ${providerName}`);
    }

    if (!provider.isAvailable()) {
      throw new Error(`Provider ${provider.name} is not available`);
    }

    return await provider.generateCompletion(messages, options);
  }

  async healthCheck(): Promise<{ providers: any[] }> {
    const healthChecks = await Promise.all(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        try {
          const health = await provider.healthCheck();
          return {
            name,
            ...health,
            available: provider.isAvailable(),
          };
        } catch (error) {
          return {
            name,
            status: "error",
            error: (error as Error).message,
            available: false,
          };
        }
      })
    );

    return { providers: healthChecks };
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys()).filter((name) => {
      const provider = this.providers.get(name);
      return provider?.isAvailable() || false;
    });
  }

  getAllProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getProviderStatus(name: string): {
    available: boolean;
    initialized: boolean;
  } {
    const provider = this.providers.get(name);
    return {
      available: provider?.isAvailable() || false,
      initialized: !!provider,
    };
  }

  getProviderConfig(name: string): any {
    // Use unified config manager first, then fall back to legacy
    const unifiedConfig = getUnifiedProviderConfig(name);
    if (unifiedConfig) {
      return {
        apiKey: unifiedConfig.apiKey,
        model: unifiedConfig.model,
        temperature: unifiedConfig.temperature,
        maxTokens: unifiedConfig.maxTokens,
        timeout: unifiedConfig.timeout,
        baseUrl: unifiedConfig.baseUrl,
      };
    }

    // Legacy fallback (will be deprecated)
    return {
      apiKey: getApiKey(name),
      model: getModel(name),
    };
  }
}
