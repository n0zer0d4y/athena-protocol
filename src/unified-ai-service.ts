import { generateText } from "ai";
import { PROVIDER_CLASSES } from "./ai-providers/index.js";
import {
  getApiKey,
  getModel,
  getBestAvailableProvider,
  getTemperature,
  getMaxTokens,
  getBaseUrl,
  getTimeout,
  getProviderConfigWithOverrides,
} from "./config-manager.js";
import { getMetricsCollector } from "./utils/metrics-collector.js";

// Lazy import provider classes
const providerImports = PROVIDER_CLASSES;

// Provider instance cache
const providerInstanceCache = new Map<string, any>();

// Client cache for performance
const clientCache = new Map<string, { client: any; timestamp: number }>();
const CLIENT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a provider instance
 */
async function getProvider(providerName: string) {
  const normalizedName = providerName?.toLowerCase();

  if (
    !normalizedName ||
    !providerImports[normalizedName as keyof typeof providerImports]
  ) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }

  if (!providerInstanceCache.has(normalizedName)) {
    const ProviderClass = await providerImports[
      normalizedName as keyof typeof providerImports
    ]();
    const providerInstance = new ProviderClass();
    providerInstanceCache.set(normalizedName, providerInstance);
  }

  return providerInstanceCache.get(normalizedName);
}

/**
 * Get cached client for performance optimization
 */
function getCachedClient(
  provider: any,
  providerName: string,
  apiKey: string,
  baseURL?: string
) {
  const cacheKey = `${providerName}:${apiKey}:${baseURL || "default"}`;
  const cached = clientCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
    return cached.client;
  }

  const client = provider.getClient({ apiKey, baseURL });
  clientCache.set(cacheKey, { client, timestamp: Date.now() });
  return client;
}

/**
 * Unified service for generating text with any configured provider
 */
export async function generateTextService(params: {
  systemPrompt?: string;
  prompt: string;
  providerOverride?: string;
  modelOverride?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const { systemPrompt, prompt, providerOverride, modelOverride } = params;

  const providerName = providerOverride || getBestAvailableProvider();
  if (!providerName) {
    throw new Error(
      "No provider available. Please configure at least one LLM provider."
    );
  }

  // Get unified provider configuration with parameter overrides
  const config = getProviderConfigWithOverrides(providerName, {
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    modelOverride: modelOverride,
  });

  if (!config.apiKey) {
    throw new Error(`No API key configured for provider: ${providerName}`);
  }

  // Extract apiKey after null check to satisfy TypeScript
  const apiKey = config.apiKey as string;
  const provider = await getProvider(providerName);

  try {
    const client = getCachedClient(
      provider,
      providerName,
      apiKey,
      config.baseUrl || undefined
    );
    const model = client(config.model);

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const apiParams: any = {
      model,
      messages,
      temperature: config.temperature,
      ...provider.prepareTokenParam(config.model, config.maxTokens),
    };

    // Add GPT-5 specific parameters if supported (unified reasoning model support)
    if (config.maxCompletionTokens) {
      apiParams.maxCompletionTokens = config.maxCompletionTokens;
    }
    if (config.verbosity) {
      apiParams.verbosity = config.verbosity;
    }
    if (config.reasoningEffort) {
      apiParams.reasoningEffort = config.reasoningEffort;
    }

    const metricsCollector = getMetricsCollector();
    const startTime = Date.now();

    try {
      const response = await generateText(apiParams);
      const responseTime = Date.now() - startTime;
      metricsCollector.recordProviderCall(providerName, responseTime, true);
      return response.text;
    } catch (providerError) {
      const responseTime = Date.now() - startTime;
      metricsCollector.recordProviderCall(
        providerName,
        responseTime,
        false,
        (providerError as Error).message
      );
      throw providerError;
    }
  } catch (error) {
    // Enhanced error handling with provider override context
    if (providerOverride) {
      throw new Error(
        `Provider override '${providerOverride}' failed: ${
          (error as Error).message
        }. ` +
          `The specified provider override encountered an error. Try using the default provider or check your API credentials.`
      );
    }
    throw new Error(
      `API call failed for ${providerName}: ${(error as Error).message}`
    );
  }
}

/**
 * Generate structured object using any configured provider
 */
export async function generateObjectService(params: {
  systemPrompt?: string;
  prompt: string;
  schema: any;
  providerOverride?: string;
  modelOverride?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<any> {
  const { systemPrompt, prompt, schema, providerOverride, modelOverride } =
    params;

  const providerName = providerOverride || getBestAvailableProvider();
  if (!providerName) {
    throw new Error(
      "No provider available. Please configure at least one LLM provider."
    );
  }

  // Get unified provider configuration with parameter overrides (includes GPT-5 support)
  const config = getProviderConfigWithOverrides(providerName, {
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    modelOverride: modelOverride,
  });

  if (!config.apiKey) {
    throw new Error(`No API key configured for provider: ${providerName}`);
  }

  // Extract apiKey after null check to satisfy TypeScript
  const apiKey = config.apiKey as string;
  const provider = await getProvider(providerName);

  try {
    // Build parameters object with GPT-5 support
    const apiParams: any = {
      apiKey: apiKey,
      model: config.model,
      systemPrompt,
      prompt,
      schema,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };

    // Add GPT-5 specific parameters if supported
    if (config.maxCompletionTokens) {
      apiParams.maxCompletionTokens = config.maxCompletionTokens;
    }
    if (config.verbosity) {
      apiParams.verbosity = config.verbosity;
    }
    if (config.reasoningEffort) {
      apiParams.reasoningEffort = config.reasoningEffort;
    }

    const metricsCollector = getMetricsCollector();
    const startTime = Date.now();

    try {
      const result = await provider.generateObject(apiParams);
      const responseTime = Date.now() - startTime;
      metricsCollector.recordProviderCall(providerName, responseTime, true);
      return result;
    } catch (providerError) {
      const responseTime = Date.now() - startTime;
      metricsCollector.recordProviderCall(
        providerName,
        responseTime,
        false,
        (providerError as Error).message
      );
      throw providerError;
    }
  } catch (error) {
    // Enhanced error handling with provider override context
    if (providerOverride) {
      throw new Error(
        `Provider override '${providerOverride}' failed: ${
          (error as Error).message
        }. ` +
          `The specified provider override encountered an error. Try using the default provider or check your API credentials.`
      );
    }
    throw new Error(
      `Object generation failed for ${providerName}: ${
        (error as Error).message
      }`
    );
  }
}

/**
 * Stream text using any configured provider
 */
export async function streamTextService(params: {
  systemPrompt?: string;
  prompt: string;
  providerOverride?: string;
  modelOverride?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<any> {
  const { systemPrompt, prompt, providerOverride, modelOverride } = params;

  const providerName = providerOverride || getBestAvailableProvider();
  if (!providerName) {
    throw new Error(
      "No provider available. Please configure at least one LLM provider."
    );
  }

  // Get unified provider configuration with parameter overrides (includes GPT-5 support)
  const config = getProviderConfigWithOverrides(providerName, {
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    modelOverride: modelOverride,
  });

  if (!config.apiKey) {
    throw new Error(`No API key configured for provider: ${providerName}`);
  }

  // Extract apiKey after null check to satisfy TypeScript
  const apiKey = config.apiKey as string;
  const provider = await getProvider(providerName);

  try {
    // Build parameters object with GPT-5 support
    const apiParams: any = {
      apiKey: apiKey,
      modelId: config.model,
      messages: systemPrompt
        ? [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ]
        : [{ role: "user", content: prompt }],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };

    // Add GPT-5 specific parameters if supported
    if (config.maxCompletionTokens) {
      apiParams.maxCompletionTokens = config.maxCompletionTokens;
    }
    if (config.verbosity) {
      apiParams.verbosity = config.verbosity;
    }
    if (config.reasoningEffort) {
      apiParams.reasoningEffort = config.reasoningEffort;
    }

    const metricsCollector = getMetricsCollector();
    const startTime = Date.now();

    try {
      const result = await provider.streamText(apiParams);
      const responseTime = Date.now() - startTime;
      metricsCollector.recordProviderCall(providerName, responseTime, true);
      return result;
    } catch (providerError) {
      const responseTime = Date.now() - startTime;
      metricsCollector.recordProviderCall(
        providerName,
        responseTime,
        false,
        (providerError as Error).message
      );
      throw providerError;
    }
  } catch (error) {
    // Enhanced error handling with provider override context
    if (providerOverride) {
      throw new Error(
        `Provider override '${providerOverride}' failed: ${
          (error as Error).message
        }. ` +
          `The specified provider override encountered an error. Try using the default provider or check your API credentials.`
      );
    }
    throw new Error(
      `Text streaming failed for ${providerName}: ${(error as Error).message}`
    );
  }
}

/**
 * Stream object using any configured provider
 */
export async function streamObjectService(params: {
  systemPrompt?: string;
  prompt: string;
  schema: any;
  providerOverride?: string;
  modelOverride?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<any> {
  const { systemPrompt, prompt, schema, providerOverride, modelOverride } =
    params;

  const providerName = providerOverride || getBestAvailableProvider();
  if (!providerName) {
    throw new Error(
      "No provider available. Please configure at least one LLM provider."
    );
  }

  // Get unified provider configuration with parameter overrides (includes GPT-5 support)
  const config = getProviderConfigWithOverrides(providerName, {
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    modelOverride: modelOverride,
  });

  if (!config.apiKey) {
    throw new Error(`No API key configured for provider: ${providerName}`);
  }

  // Extract apiKey after null check to satisfy TypeScript
  const apiKey = config.apiKey as string;
  const provider = await getProvider(providerName);

  try {
    // Build parameters object with GPT-5 support
    const apiParams: any = {
      apiKey: apiKey,
      modelId: config.model,
      messages: systemPrompt
        ? [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ]
        : [{ role: "user", content: prompt }],
      schema,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };

    // Add GPT-5 specific parameters if supported
    if (config.maxCompletionTokens) {
      apiParams.maxCompletionTokens = config.maxCompletionTokens;
    }
    if (config.verbosity) {
      apiParams.verbosity = config.verbosity;
    }
    if (config.reasoningEffort) {
      apiParams.reasoningEffort = config.reasoningEffort;
    }

    const metricsCollector = getMetricsCollector();
    const startTime = Date.now();

    try {
      const result = await provider.streamObject(apiParams);
      const responseTime = Date.now() - startTime;
      metricsCollector.recordProviderCall(providerName, responseTime, true);
      return result;
    } catch (providerError) {
      const responseTime = Date.now() - startTime;
      metricsCollector.recordProviderCall(
        providerName,
        responseTime,
        false,
        (providerError as Error).message
      );
      throw providerError;
    }
  } catch (error) {
    // Enhanced error handling with provider override context
    if (providerOverride) {
      throw new Error(
        `Provider override '${providerOverride}' failed: ${
          (error as Error).message
        }. ` +
          `The specified provider override encountered an error. Try using the default provider or check your API credentials.`
      );
    }
    throw new Error(
      `Object streaming failed for ${providerName}: ${(error as Error).message}`
    );
  }
}

/**
 * Test provider health
 */
export async function testProviderHealth(providerName: string): Promise<{
  provider: string;
  status: "healthy" | "unhealthy";
  model: string | null;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const apiKey = getApiKey(providerName);
    const model = getModel(providerName);

    if (!apiKey) {
      return {
        provider: providerName,
        status: "unhealthy",
        model,
        responseTime: Date.now() - startTime,
        error: "No API key configured",
      };
    }

    await generateTextService({
      systemPrompt: "You are a helpful assistant.",
      prompt: 'Say "Hello" in exactly one word.',
      providerOverride: providerName,
      modelOverride: model,
    });

    const responseTime = Date.now() - startTime;

    return {
      provider: providerName,
      status: "healthy",
      model,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      provider: providerName,
      status: "unhealthy",
      model: getModel(providerName),
      responseTime,
      error: (error as Error).message,
    };
  }
}

/**
 * Clear all caches (useful for testing or memory management)
 */
export function clearCaches(): void {
  providerInstanceCache.clear();
  clientCache.clear();
}

/**
 * Get provider instance (for advanced usage)
 */
export async function getProviderInstance(providerName: string) {
  return await getProvider(providerName);
}
