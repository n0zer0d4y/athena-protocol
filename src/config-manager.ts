// Configuration Manager with caching and validation
import { ToolCallingConfig } from "./services/tool-calling-service.js";
import {
  SUPPORTED_PROVIDERS,
  PROVIDER_API_KEYS,
  providerSupportsFeature,
} from "./ai-providers/index.js";

// ==========================================
// INTERFACES (moved from llm-config.ts)
// ==========================================

// ToolCallingConfig is imported from tool-calling-service.ts

export interface LLMProviderConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  // GPT-5 specific parameters (optional)
  maxCompletionTokens?: number;
  verbosity?: "low" | "medium" | "high";
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
}

export interface AthenaProtocolConfig {
  providers: LLMProviderConfig[];
  defaultProvider?: string;
  memory: {
    maxShortTermEntries: number;
    maxPersistentEntries: number;
    compressionThreshold: number;
    relevanceThreshold: number;
  };
  logging: {
    enabled: boolean;
    level: "debug" | "info" | "warn" | "error";
    path: string;
  };
}

// Unified Environment Cache System
interface ConfigCache {
  value: any;
  timestamp: number;
  ttl: number;
}

/**
 * Unified Environment Cache with TTL support, invalidation, and concurrency protection
 */
class EnvironmentCache {
  private cache = new Map<string, ConfigCache>();
  private inFlight = new Map<string, Promise<any>>();
  private defaultTTL: number | undefined = 30000; // 30 seconds, undefined = no expiry
  private sweepIntervalId?: NodeJS.Timeout;

  constructor(options: { defaultTTL?: number; sweepIntervalMs?: number } = {}) {
    this.defaultTTL = options.defaultTTL;

    // Optional sweep interval for bulk cleanup
    if (options.sweepIntervalMs) {
      this.sweepIntervalId = setInterval(
        () => this.sweep(),
        options.sweepIntervalMs
      );
    }
  }

  get(key: string, ttl?: number): any | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    const effectiveTTL = ttl ?? entry.ttl;

    // Lazy expiration check
    if (effectiveTTL !== undefined && now - entry.timestamp > effectiveTTL) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: any, ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL ?? Infinity,
    });
  }

  delete(key: string): boolean {
    this.inFlight.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
    if (this.sweepIntervalId) {
      clearInterval(this.sweepIntervalId);
      this.sweepIntervalId = undefined;
    }
  }

  /**
   * Invalidate cache entries based on safe pattern matching
   * Supports prefix (*_SUFFIX), suffix (PREFIX_*), and exact matches
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      this.inFlight.clear();
      return;
    }

    // Safe pattern matching - avoid ReDoS risks
    const keys = Array.from(this.cache.keys());

    if (pattern.endsWith("*")) {
      // Prefix match: "DB_*" matches "DB_HOST", "DB_PORT"
      const prefix = pattern.slice(0, -1);
      keys.forEach((key) => {
        if (key.startsWith(prefix)) {
          this.delete(key);
        }
      });
    } else if (pattern.startsWith("*")) {
      // Suffix match: "*_KEY" matches "API_KEY", "DB_KEY"
      const suffix = pattern.slice(1);
      keys.forEach((key) => {
        if (key.endsWith(suffix)) {
          this.delete(key);
        }
      });
    } else {
      // Exact match or contains
      keys.forEach((key) => {
        if (key.includes(pattern)) {
          this.delete(key);
        }
      });
    }
  }

  /**
   * Get value with computation and concurrency protection
   */
  async getOrCompute<T>(
    key: string,
    resolver: () => T | Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get(key, ttl);
    if (cached !== undefined) {
      return cached;
    }

    // Check if computation is already in flight
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    // Start new computation
    const promise = Promise.resolve(resolver()).then(
      (value) => {
        this.set(key, value, ttl);
        this.inFlight.delete(key);
        return value;
      },
      (error) => {
        this.inFlight.delete(key);
        throw error;
      }
    );

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Manual sweep to remove expired entries
   */
  sweep(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl !== undefined && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; inFlightCount: number } {
    return {
      size: this.cache.size,
      inFlightCount: this.inFlight.size,
    };
  }

  /**
   * Close and cleanup resources
   */
  close(): void {
    this.clear();
  }
}

// Global cache instance - maintains backward compatibility
const envCache = new EnvironmentCache({ defaultTTL: 30000 }); // 30 seconds

// ==========================================
// ERROR HANDLING SYSTEM
// ==========================================

/**
 * Error categories for consistent error handling and troubleshooting
 */
export enum ErrorCategory {
  CONFIGURATION = "configuration",
  NETWORK = "network",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  RATE_LIMIT = "rate_limit",
  TIMEOUT = "timeout",
  VALIDATION = "validation",
  PROVIDER = "provider_error",
  NOT_FOUND = "not_found",
  CONFLICT = "conflict",
  UNKNOWN = "unknown",
}

/**
 * Standardized error class with categorization and troubleshooting
 */
export class StandardError extends Error {
  public readonly category: ErrorCategory;
  public readonly code?: string;
  public readonly provider?: string;
  public readonly troubleshooting: string;
  public readonly isOperational: boolean;
  public readonly timestamp: string;

  constructor(options: {
    message: string;
    category: ErrorCategory;
    code?: string;
    provider?: string;
    troubleshooting: string;
    cause?: Error;
    isOperational?: boolean;
  }) {
    super(options.message);

    this.name = "StandardError";
    this.category = options.category;
    this.code = options.code;
    this.provider = options.provider;
    this.troubleshooting = options.troubleshooting;
    this.isOperational = options.isOperational ?? true;
    this.timestamp = new Date().toISOString();

    // Preserve cause chain
    if (options.cause) {
      this.cause = options.cause;
    }

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, StandardError.prototype);
  }

  /**
   * Serialize error for logging/JSON output (no secret leakage)
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      code: this.code,
      provider: this.provider,
      troubleshooting: this.troubleshooting,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Categorize errors based on error type, code, and context
 */
export function categorizeError(
  error: unknown,
  provider?: string
): ErrorCategory {
  if (!error) return ErrorCategory.UNKNOWN;

  // Handle StandardError (already categorized)
  if (error instanceof StandardError) {
    return error.category;
  }

  // Handle Node.js system errors
  if (typeof error === "object" && error !== null && "code" in error) {
    const nodeError = error as { code: string; [key: string]: any };

    switch (nodeError.code) {
      case "ENOTFOUND":
      case "ECONNREFUSED":
      case "ECONNRESET":
      case "EHOSTUNREACH":
      case "ENETUNREACH":
        return ErrorCategory.NETWORK;

      case "ETIMEDOUT":
      case "ESOCKETTIMEDOUT":
        return ErrorCategory.TIMEOUT;

      case "ENOENT":
        return ErrorCategory.NOT_FOUND;

      default:
        break;
    }
  }

  // Handle HTTP status codes
  if (typeof error === "object" && error !== null) {
    const httpError = error as {
      status?: number;
      statusCode?: number;
      response?: { status: number };
    };
    const status =
      httpError.status || httpError.statusCode || httpError.response?.status;

    if (status) {
      if (status === 401) return ErrorCategory.AUTHENTICATION;
      if (status === 403) return ErrorCategory.AUTHORIZATION;
      if (status === 404) return ErrorCategory.NOT_FOUND;
      if (status === 408 || status === 504) return ErrorCategory.TIMEOUT;
      if (status === 409) return ErrorCategory.CONFLICT;
      if (status === 422 || (status >= 400 && status < 500))
        return ErrorCategory.VALIDATION;
      if (status === 429) return ErrorCategory.RATE_LIMIT;
      if (status >= 500) return ErrorCategory.PROVIDER;
    }
  }

  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Configuration-related errors
    if (
      message.includes("must be set") ||
      message.includes("not found") ||
      message.includes("invalid") ||
      message.includes("missing")
    ) {
      return ErrorCategory.CONFIGURATION;
    }

    // Network-related errors
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("dns") ||
      message.includes("resolve")
    ) {
      return ErrorCategory.NETWORK;
    }

    // Authentication/Authorization
    if (
      message.includes("unauthorized") ||
      message.includes("invalid key") ||
      message.includes("authentication")
    ) {
      return ErrorCategory.AUTHENTICATION;
    }

    // Timeout
    if (message.includes("timeout") || message.includes("timed out")) {
      return ErrorCategory.TIMEOUT;
    }

    // Rate limiting
    if (message.includes("rate limit") || message.includes("too many")) {
      return ErrorCategory.RATE_LIMIT;
    }
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Get actionable troubleshooting hint based on error category and context
 */
export function getTroubleshootingHint(
  category: ErrorCategory,
  provider?: string,
  context?: { envVar?: string; operation?: string }
): string {
  const providerName = provider || "the provider";

  switch (category) {
    case ErrorCategory.CONFIGURATION:
      if (context?.envVar) {
        return `Check your .env file: ensure ${context.envVar} is set with a valid value. Restart the application after making changes.`;
      }
      return `Verify your configuration in the .env file. Ensure all required environment variables are set with valid values.`;

    case ErrorCategory.AUTHENTICATION:
      return `Verify your API key for ${providerName}. Check that the key is valid, not expired, and has proper permissions. You may need to regenerate the key.`;

    case ErrorCategory.AUTHORIZATION:
      return `Your API key lacks required permissions for ${providerName}. Check your account plan, billing status, and API key permissions.`;

    case ErrorCategory.NETWORK:
      return `Network connectivity issue with ${providerName}. Check your internet connection, firewall settings, and DNS resolution.`;

    case ErrorCategory.TIMEOUT:
      return `Request to ${providerName} timed out. Try increasing the timeout value or check if the service is experiencing high load.`;

    case ErrorCategory.RATE_LIMIT:
      return `Rate limit exceeded for ${providerName}. Wait before retrying or upgrade your plan for higher limits.`;

    case ErrorCategory.VALIDATION:
      return `Invalid request to ${providerName}. Check your input parameters, model names, and API usage patterns.`;

    case ErrorCategory.PROVIDER:
      return `${providerName} service error. Check the provider's status page and try again later. Consider using a fallback provider.`;

    case ErrorCategory.NOT_FOUND:
      return `Resource not found on ${providerName}. Verify the model name, endpoint, and that the resource exists.`;

    case ErrorCategory.CONFLICT:
      return `Resource conflict on ${providerName}. Check for duplicate requests or conflicting operations.`;

    case ErrorCategory.UNKNOWN:
    default:
      return `Unexpected error with ${providerName}. Check logs for details and consider reporting the issue if it persists.`;
  }
}

/**
 * Resolve environment variable with caching - NO DEFAULTS
 * Maintains backward compatibility with existing signature
 */
function resolveEnvVariableCached(key: string): string | undefined {
  const cacheKey = `env_${key}`;

  // Check cache first (lazy expiration handled internally)
  const cached = envCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Get fresh value and cache it
  const value = process.env[key];
  envCache.set(cacheKey, value);
  return value;
}

/**
 * Get API key for a specific provider
 */
export function getApiKey(providerName: string): string | null {
  const envKey =
    PROVIDER_API_KEYS[providerName as keyof typeof PROVIDER_API_KEYS];
  if (!envKey) {
    return null;
  }

  const apiKey = resolveEnvVariableCached(envKey);
  if (!apiKey || !apiKey.trim()) {
    return null;
  }

  return apiKey.trim();
}

/**
 * Get model configuration for a provider with fallback to defaults
 * @throws {Error} When neither model nor default is configured for the provider
 */
export function getModel(providerName: string): string {
  const userModel = resolveEnvVariableCached(
    `${providerName.toUpperCase()}_MODEL`
  );
  if (userModel?.trim()) {
    return userModel.trim();
  }

  // Fall back to default model
  const defaultModel = resolveEnvVariableCached(
    `${providerName.toUpperCase()}_MODEL_DEFAULT`
  );
  if (defaultModel?.trim()) {
    return defaultModel.trim();
  }

  throw new StandardError({
    message: `Model configuration missing for ${providerName}`,
    category: ErrorCategory.CONFIGURATION,
    code: "MODEL_NOT_SET",
    provider: providerName,
    troubleshooting: getTroubleshootingHint(
      ErrorCategory.CONFIGURATION,
      providerName,
      {
        envVar: `${providerName.toUpperCase()}_MODEL or ${providerName.toUpperCase()}_MODEL_DEFAULT`,
      }
    ),
  });
}

/**
 * Get configured providers with their status
 */
export function getConfiguredProviders(): Array<{
  name: string;
  model: string | null;
  hasApiKey: boolean;
}> {
  const providers = [];

  for (const name of SUPPORTED_PROVIDERS) {
    const apiKey = getApiKey(name);
    const hasApiKey = apiKey ? validateApiKey(name, apiKey) : false;
    let model: string | null = null;

    if (hasApiKey) {
      model = getModel(name);
    }

    providers.push({
      name,
      model,
      hasApiKey,
    });
  }

  return providers;
}

/**
 * Get temperature setting for a provider - STRICT: no fallbacks
 * @throws {Error} When temperature is not configured for the provider
 */
export function getTemperature(providerName: string): number {
  const providerValue = resolveEnvVariableCached(
    `${providerName.toUpperCase()}_TEMPERATURE`
  );
  if (providerValue?.trim()) {
    const temp = Number(providerValue.trim());
    if (!isNaN(temp) && temp >= 0 && temp <= 2) {
      return temp;
    }
  }

  const globalValue = resolveEnvVariableCached("LLM_TEMPERATURE");
  if (globalValue?.trim()) {
    const temp = Number(globalValue.trim());
    if (!isNaN(temp) && temp >= 0 && temp <= 2) {
      return temp;
    }
  }

  // Fall back to default temperature
  const defaultValue = resolveEnvVariableCached("LLM_TEMPERATURE_DEFAULT");
  if (defaultValue?.trim()) {
    const temp = Number(defaultValue.trim());
    if (!isNaN(temp) && temp >= 0 && temp <= 2) {
      return temp;
    }
  }

  throw new StandardError({
    message: `Temperature configuration missing for ${providerName}`,
    category: ErrorCategory.CONFIGURATION,
    code: "TEMPERATURE_NOT_SET",
    provider: providerName,
    troubleshooting: getTroubleshootingHint(
      ErrorCategory.CONFIGURATION,
      providerName,
      {
        envVar: `${providerName.toUpperCase()}_TEMPERATURE, LLM_TEMPERATURE, or LLM_TEMPERATURE_DEFAULT`,
      }
    ),
  });
}

/**
 * Get max tokens setting for a provider - STRICT: no fallbacks
 * @throws {Error} When max tokens is not configured for the provider
 */
export function getMaxTokens(providerName: string): number {
  const providerValue = resolveEnvVariableCached(
    `${providerName.toUpperCase()}_MAX_TOKENS`
  );
  if (providerValue?.trim()) {
    const tokens = Number(providerValue.trim());
    if (!isNaN(tokens) && tokens > 0) {
      return Math.floor(tokens);
    }
  }

  const globalValue = resolveEnvVariableCached("LLM_MAX_TOKENS");
  if (globalValue?.trim()) {
    const tokens = Number(globalValue.trim());
    if (!isNaN(tokens) && tokens > 0) {
      return Math.floor(tokens);
    }
  }

  // Fall back to default max tokens
  const defaultValue = resolveEnvVariableCached("LLM_MAX_TOKENS_DEFAULT");
  if (defaultValue?.trim()) {
    const tokens = Number(defaultValue.trim());
    if (!isNaN(tokens) && tokens > 0) {
      return Math.floor(tokens);
    }
  }

  throw new StandardError({
    message: `Max tokens configuration missing for ${providerName}`,
    category: ErrorCategory.CONFIGURATION,
    code: "MAX_TOKENS_NOT_SET",
    provider: providerName,
    troubleshooting: getTroubleshootingHint(
      ErrorCategory.CONFIGURATION,
      providerName,
      {
        envVar: `${providerName.toUpperCase()}_MAX_TOKENS, LLM_MAX_TOKENS, or LLM_MAX_TOKENS_DEFAULT`,
      }
    ),
  });
}

/**
 * Get default provider setting - STRICT: no fallbacks
 * @throws {Error} When DEFAULT_LLM_PROVIDER is not configured
 */
export function getDefaultProvider(): string {
  const provider = resolveEnvVariableCached("DEFAULT_LLM_PROVIDER");
  if (!provider?.trim()) {
    throw new StandardError({
      message: "Default provider configuration missing",
      category: ErrorCategory.CONFIGURATION,
      code: "DEFAULT_PROVIDER_NOT_SET",
      troubleshooting: getTroubleshootingHint(
        ErrorCategory.CONFIGURATION,
        undefined,
        { envVar: "DEFAULT_LLM_PROVIDER" }
      ),
    });
  }
  return provider.trim();
}

/**
 * Validate API key for authenticity (checks for placeholder patterns)
 */
export function validateApiKey(providerName: string, apiKey: string): boolean {
  if (!apiKey || apiKey.trim() === "") return false;

  // Skip strict validation during tests if TEST_MODE is enabled
  if (process.env.NODE_ENV === "test" || process.env.TEST_MODE === "true") {
    // In test mode, accept any non-empty key that doesn't look like a common placeholder
    return (
      !apiKey.includes("your_") &&
      !apiKey.includes("_here") &&
      !apiKey.includes("placeholder")
    );
  }

  // Check for common placeholder patterns
  const placeholderPatterns = [
    /^sk-ant-your-/,
    /^your[-_].*[-_]key[-_]here$/i,
    /^your[-_].*[-_]here$/i,
    /^placeholder/i,
    /^dummy/i,
    /^test.*key/i,
    /^example/i,
    /^api[_-]?key/i,
    /^replace[_-]?me/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(apiKey)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a provider is configured with a valid API key
 */
export function isProviderConfigured(providerName: string): boolean {
  const apiKey = getApiKey(providerName);
  return apiKey ? validateApiKey(providerName, apiKey) : false;
}

/**
 * Get provider priority list from environment configuration
 * @throws {Error} When PROVIDER_SELECTION_PRIORITY is missing or invalid
 */
export function getProviderPriority(): string[] {
  const priority = resolveEnvVariableCached("PROVIDER_SELECTION_PRIORITY");
  if (priority?.trim()) {
    const providers = priority
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (providers.length > 0) {
      // Validate against supported providers
      const invalidProviders = providers.filter(
        (p) => !SUPPORTED_PROVIDERS.includes(p)
      );
      if (invalidProviders.length > 0) {
        throw new StandardError({
          message: `Invalid providers in priority configuration: ${invalidProviders.join(
            ", "
          )}`,
          category: ErrorCategory.CONFIGURATION,
          code: "INVALID_PROVIDERS",
          troubleshooting: `Only these providers are supported: ${SUPPORTED_PROVIDERS.join(
            ", "
          )}. Remove or replace invalid providers in PROVIDER_SELECTION_PRIORITY.`,
        });
      }
      return providers;
    }
  }

  // Fallback: Create priority based on default provider + configured providers
  try {
    const defaultProvider = getDefaultProvider();
    const configuredProviders = getConfiguredProviders()
      .filter((p) => p.hasApiKey)
      .map((p) => p.name);

    // Put default first, then others
    const priorityList = [defaultProvider];
    configuredProviders.forEach((provider) => {
      if (provider !== defaultProvider) {
        priorityList.push(provider);
      }
    });

    return priorityList;
  } catch (error) {
    // If we can't get default provider either, return all configured providers
    return getConfiguredProviders()
      .filter((p) => p.hasApiKey)
      .map((p) => p.name);
  }
}

/**
 * Get the best available provider based on configuration and priority
 */
export function getBestAvailableProvider(): string | null {
  const defaultProvider = getDefaultProvider();

  if (defaultProvider && isProviderConfigured(defaultProvider)) {
    return defaultProvider;
  }

  const providerPriority = getProviderPriority();

  for (const provider of providerPriority) {
    if (isProviderConfigured(provider)) {
      return provider;
    }
  }

  return null;
}

/**
 * Get base URL for a provider (if applicable)
 */
export function getBaseUrl(providerName: string): string | undefined {
  const baseUrl = resolveEnvVariableCached(
    `${providerName.toUpperCase()}_BASE_URL`
  );
  return baseUrl && baseUrl.trim() ? baseUrl.trim() : undefined;
}

/**
 * Get timeout setting for a provider - STRICT: no fallbacks
 * @throws {Error} When timeout is not configured for the provider
 */
export function getTimeout(providerName: string): number {
  const providerValue = resolveEnvVariableCached(
    `${providerName.toUpperCase()}_TIMEOUT`
  );
  if (providerValue?.trim()) {
    const timeout = Number(providerValue.trim());
    if (!isNaN(timeout) && timeout > 0) {
      return Math.floor(timeout);
    }
  }

  const globalValue = resolveEnvVariableCached("LLM_TIMEOUT");
  if (globalValue?.trim()) {
    const timeout = Number(globalValue.trim());
    if (!isNaN(timeout) && timeout > 0) {
      return Math.floor(timeout);
    }
  }

  // Fall back to default timeout
  const defaultValue = resolveEnvVariableCached("LLM_TIMEOUT_DEFAULT");
  if (defaultValue?.trim()) {
    const timeout = Number(defaultValue.trim());
    if (!isNaN(timeout) && timeout > 0) {
      return Math.floor(timeout);
    }
  }

  throw new StandardError({
    message: `Timeout configuration missing for ${providerName}`,
    category: ErrorCategory.CONFIGURATION,
    code: "TIMEOUT_NOT_SET",
    provider: providerName,
    troubleshooting: getTroubleshootingHint(
      ErrorCategory.CONFIGURATION,
      providerName,
      {
        envVar: `${providerName.toUpperCase()}_TIMEOUT, LLM_TIMEOUT, or LLM_TIMEOUT_DEFAULT`,
      }
    ),
  });
}

/**
 * Clear the environment variable cache (useful for testing)
 * Maintains backward compatibility
 */
export function clearEnvCache(): void {
  envCache.clear();
}

/**
 * Invalidate cache entries by pattern
 * @param pattern - Pattern for invalidation: "PREFIX_*", "*_SUFFIX", or "EXACT_MATCH"
 */
export function invalidateCache(pattern?: string): void {
  envCache.invalidate(pattern);
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): { size: number; inFlightCount: number } {
  return envCache.getStats();
}

/**
 * Export unified cache instance for advanced usage
 */
export { envCache as unifiedCache };

// ==========================================
// UNIFIED CONFIGURATION SYSTEM
// ==========================================

/**
 * Comprehensive provider configuration interface
 */
export interface ProviderConfiguration {
  readonly name: string;
  readonly apiKey: string | null;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly timeout: number;
  readonly hasApiKey: boolean;
  readonly hasModel: boolean;
  readonly baseUrl?: string;
  // GPT-5 specific parameters
  readonly maxCompletionTokens?: number;
  readonly verbosity?: "low" | "medium" | "high";
  readonly reasoningEffort?: "minimal" | "low" | "medium" | "high";
}

/**
 * Unified configuration cache with lazy initialization
 */
class UnifiedConfigManager {
  private providerConfigs = new Map<string, ProviderConfiguration>();
  private initialized = false;
  private featureFlag = "CONFIG_UNIFIED";

  /**
   * Check if unified config is enabled (feature flag)
   */
  private isEnabled(): boolean {
    return (
      process.env[this.featureFlag] === "1" ||
      process.env[this.featureFlag] === "true"
    );
  }

  /**
   * Initialize all provider configurations (lazy)
   */
  private initialize(): void {
    if (this.initialized) return;

    // Clear existing cache
    this.providerConfigs.clear();

    // Load configuration for all supported providers
    console.error(
      `[DEBUG] Loading configs for providers: ${SUPPORTED_PROVIDERS.join(", ")}`
    );
    for (const providerName of SUPPORTED_PROVIDERS) {
      console.error(`[DEBUG] Loading config for ${providerName}...`);
      try {
        const config = this.loadProviderConfiguration(providerName);
        this.providerConfigs.set(providerName, Object.freeze(config));
        console.error(`[DEBUG] Successfully loaded config for ${providerName}`);
      } catch (error) {
        // Skip providers with invalid configuration in non-strict mode
        if (process.env.CONFIG_STRICT === "1") {
          throw error;
        }
        // In permissive mode, create minimal config
        const minimalConfig: ProviderConfiguration = {
          name: providerName,
          apiKey: getApiKey(providerName),
          model: "",
          temperature: 0.7,
          maxTokens: 2000,
          timeout: 30000,
          hasApiKey: !!getApiKey(providerName),
          hasModel: false,
        };
        this.providerConfigs.set(providerName, Object.freeze(minimalConfig));
      }
    }

    this.initialized = true;
  }

  /**
   * Load complete configuration for a single provider
   */
  private loadProviderConfiguration(
    providerName: string
  ): ProviderConfiguration {
    const apiKey = getApiKey(providerName);
    const hasApiKey = !!apiKey;

    // Only load full config if API key is present
    if (!hasApiKey) {
      return {
        name: providerName,
        apiKey: null,
        model: "",
        temperature: 0.7,
        maxTokens: 2000,
        timeout: 30000,
        hasApiKey: false,
        hasModel: false,
      };
    }

    const config: ProviderConfiguration = {
      name: providerName,
      apiKey,
      model: getModel(providerName),
      temperature: getTemperature(providerName),
      maxTokens: getMaxTokens(providerName),
      timeout: getTimeout(providerName),
      hasApiKey: true,
      hasModel: true,
      baseUrl: getBaseUrl(providerName),
    };

    // Add GPT-5 specific parameters for providers that support reasoning models
    console.error(
      `[DEBUG] Checking GPT-5 support for ${providerName}: ${providerSupportsFeature(
        providerName,
        "GPT5_REASONING"
      )}`
    );
    const supportsGPT5 = providerSupportsFeature(
      providerName,
      "GPT5_REASONING"
    );
    console.error(
      `[DEBUG] providerSupportsFeature(${providerName}, "GPT5_REASONING") = ${supportsGPT5}`
    );
    console.error(`[DEBUG] About to enter GPT-5 if block for ${providerName}`);
    if (supportsGPT5) {
      console.error(`[DEBUG] Loading GPT-5 config for ${providerName}`);
      try {
        const gptConfig = config as ProviderConfiguration & {
          maxCompletionTokens?: number;
          verbosity?: "low" | "medium" | "high";
          reasoningEffort?: "minimal" | "low" | "medium" | "high";
        };

        const maxCompletionTokens = getMaxCompletionTokens();
        if (maxCompletionTokens !== null) {
          gptConfig.maxCompletionTokens = maxCompletionTokens;
        }
        console.error(
          `[DEBUG] GPT-5 config for ${providerName}: maxCompletionTokens=${gptConfig.maxCompletionTokens}`
        );

        const verbosity = getVerbosity();
        if (verbosity && ["low", "medium", "high"].includes(verbosity)) {
          gptConfig.verbosity = verbosity as "low" | "medium" | "high";
          console.error(
            `[DEBUG] GPT-5 config for ${providerName}: verbosity=${gptConfig.verbosity}`
          );
        }

        const reasoningEffort = getReasoningEffort();
        if (
          reasoningEffort &&
          ["minimal", "low", "medium", "high"].includes(reasoningEffort)
        ) {
          gptConfig.reasoningEffort = reasoningEffort as
            | "minimal"
            | "low"
            | "medium"
            | "high";
          console.error(
            `[DEBUG] GPT-5 config for ${providerName}: reasoningEffort=${gptConfig.reasoningEffort}`
          );
        }

        console.error(`[DEBUG] Returning GPT-5 config for ${providerName}`);
        return gptConfig;
      } catch (error) {
        // GPT-5 parameters are optional, return base config
        console.error(
          `[DEBUG] Error loading GPT-5 config for ${providerName}:`,
          (error as Error).message
        );
        return config;
      }
    }

    return config;
  }

  /**
   * Get unified configuration for a provider
   */
  getProviderConfiguration(providerName: string): ProviderConfiguration | null {
    console.error(`[DEBUG] getProviderConfiguration called for ${providerName}`);
    console.error(`[DEBUG] isEnabled(): ${this.isEnabled()}`);

    if (!this.isEnabled()) {
      // Feature flag disabled, fall back to legacy approach
      console.error(`[DEBUG] Unified config disabled, returning null`);
      return null;
    }

    console.error(`[DEBUG] Initializing unified config...`);
    this.initialize();
    const config = this.providerConfigs.get(providerName) || null;
    console.error(`[DEBUG] Returning config for ${providerName}:`, !!config);
    return config;
  }

  /**
   * Get all configured providers
   */
  getAllConfigurations(): ProviderConfiguration[] {
    if (!this.isEnabled()) {
      return [];
    }

    this.initialize();
    return Array.from(this.providerConfigs.values()).filter(
      (config) => config.hasApiKey
    );
  }

  /**
   * Reset for testing
   */
  resetForTests(): void {
    this.initialized = false;
    this.providerConfigs.clear();
  }
}

// Global singleton instance
const unifiedConfigManager = new UnifiedConfigManager();

/**
 * Get unified provider configuration (with fallback to legacy)
 * This is the new recommended way to access provider configuration
 */
export function getUnifiedProviderConfig(
  providerName: string
): ProviderConfiguration | null {
  const unifiedConfig =
    unifiedConfigManager.getProviderConfiguration(providerName);

  // If unified config is available, use it
  if (unifiedConfig) {
    return unifiedConfig;
  }

  // Fallback to legacy individual function calls
  try {
    const apiKey = getApiKey(providerName);
    const hasApiKey = !!apiKey;

    if (!hasApiKey) {
      return null;
    }

    return {
      name: providerName,
      apiKey,
      model: getModel(providerName),
      temperature: getTemperature(providerName),
      maxTokens: getMaxTokens(providerName),
      timeout: getTimeout(providerName),
      hasApiKey: true,
      hasModel: true,
      baseUrl: getBaseUrl(providerName),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get all unified provider configurations
 */
export function getAllUnifiedProviderConfigs(): ProviderConfiguration[] {
  const unifiedConfigs = unifiedConfigManager.getAllConfigurations();

  // If unified config is available, use it
  if (unifiedConfigs.length > 0) {
    return unifiedConfigs;
  }

  // Fallback to legacy approach
  return getConfiguredProviders().map(
    (provider) =>
      ({
        name: provider.name,
        apiKey: getApiKey(provider.name),
        model: provider.model || "",
        temperature: getTemperature(provider.name),
        maxTokens: getMaxTokens(provider.name),
        timeout: getTimeout(provider.name),
        hasApiKey: provider.hasApiKey,
        hasModel: !!provider.model,
        baseUrl: getBaseUrl(provider.name),
      } as ProviderConfiguration)
  );
}

/**
 * Reset unified config for testing
 */
export function resetUnifiedConfigForTests(): void {
  unifiedConfigManager.resetForTests();
}

/**
 * Helper function to get provider configuration with parameter overrides
 * This eliminates the repetitive pattern in unified-ai-service.ts
 */
export function getProviderConfigWithOverrides(
  providerName: string,
  params: {
    temperature?: number;
    maxTokens?: number;
    modelOverride?: string;
  } = {}
): {
  providerName: string;
  apiKey: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  baseUrl?: string | null;
  // GPT-5 parameters
  maxCompletionTokens?: number;
  verbosity?: "low" | "medium" | "high";
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
} {
  // Try unified config first
  const unifiedConfig = getUnifiedProviderConfig(providerName);
  if (unifiedConfig) {
    return {
      providerName: unifiedConfig.name,
      apiKey: unifiedConfig.apiKey,
      model: params.modelOverride || unifiedConfig.model,
      temperature: params.temperature ?? unifiedConfig.temperature,
      maxTokens: params.maxTokens ?? unifiedConfig.maxTokens,
      timeout: unifiedConfig.timeout,
      baseUrl: unifiedConfig.baseUrl,
      maxCompletionTokens: unifiedConfig.maxCompletionTokens,
      verbosity: unifiedConfig.verbosity,
      reasoningEffort: unifiedConfig.reasoningEffort,
    };
  }

  // Fallback to legacy approach
  return {
    providerName,
    apiKey: getApiKey(providerName),
    model: params.modelOverride || getModel(providerName),
    temperature: params.temperature ?? getTemperature(providerName),
    maxTokens: params.maxTokens ?? getMaxTokens(providerName),
    timeout: getTimeout(providerName),
    baseUrl: getBaseUrl(providerName),
  };
}

/**
 * Get all configuration for a specific provider
 */
export function getProviderConfig(providerName: string): {
  apiKey: string | null;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  baseUrl: string | null;
  timeout: number | null;
} {
  try {
    return {
      apiKey: getApiKey(providerName),
      model: getModel(providerName),
      temperature: getTemperature(providerName),
      maxTokens: getMaxTokens(providerName),
      baseUrl: getBaseUrl(providerName) || null,
      timeout: getTimeout(providerName),
    };
  } catch (error) {
    // If configuration is invalid, return null values
    console.warn(`Configuration missing for provider ${providerName}:`, error);
    return {
      apiKey: null,
      model: null,
      temperature: null,
      maxTokens: null,
      baseUrl: null,
      timeout: null,
    };
  }
}

// ==========================================
// GPT-5 SPECIFIC PARAMETERS
// ==========================================

/**
 * Get max completion tokens for GPT-5 models (environment-only)
 */
export function getMaxCompletionTokens(): number | null {
  const value = resolveEnvVariableCached("OPENAI_MAX_COMPLETION_TOKENS");
  if (value && value.trim()) {
    const numValue = Number(value.trim());
    if (!isNaN(numValue) && numValue > 0) {
      return Math.floor(numValue);
    }
  }

  const defaultValue = resolveEnvVariableCached(
    "OPENAI_MAX_COMPLETION_TOKENS_DEFAULT"
  );
  if (defaultValue && defaultValue.trim()) {
    const numValue = Number(defaultValue.trim());
    if (!isNaN(numValue) && numValue > 0) {
      return Math.floor(numValue);
    }
  }

  return null;
}

/**
 * Get verbosity setting for GPT-5 models (environment-only)
 */
export function getVerbosity(): string | null {
  const value = resolveEnvVariableCached("OPENAI_VERBOSITY");
  if (value && value.trim()) {
    const validValues = ["low", "medium", "high"];
    return validValues.includes(value.trim()) ? value.trim() : null;
  }

  const defaultValue = resolveEnvVariableCached("OPENAI_VERBOSITY_DEFAULT");
  if (defaultValue && defaultValue.trim()) {
    const validValues = ["low", "medium", "high"];
    return validValues.includes(defaultValue.trim())
      ? defaultValue.trim()
      : null;
  }

  return null;
}

/**
 * Get reasoning effort for GPT-5 models (environment-only)
 */
export function getReasoningEffort(): string | null {
  const value = resolveEnvVariableCached("OPENAI_REASONING_EFFORT");
  if (value && value.trim()) {
    const validValues = ["minimal", "low", "medium", "high"];
    return validValues.includes(value.trim()) ? value.trim() : null;
  }

  const defaultValue = resolveEnvVariableCached(
    "OPENAI_REASONING_EFFORT_DEFAULT"
  );
  if (defaultValue && defaultValue.trim()) {
    const validValues = ["minimal", "low", "medium", "high"];
    return validValues.includes(defaultValue.trim())
      ? defaultValue.trim()
      : null;
  }

  return null;
}

/**
 * Check if a model is a GPT-5 model
 */
export function isGPT5Model(modelName: string): boolean {
  return (
    typeof modelName === "string" && modelName.toLowerCase().startsWith("gpt-5")
  );
}

/**
 * Get OpenAI-specific parameters, handling GPT-5 differences
 */
export function getOpenAIParameters(modelName = null) {
  // This function is deprecated - use getProviderConfigWithOverrides instead
  const providerName = "openai"; // Keep for backward compatibility until fully migrated
  const baseParams = {
    temperature: getTemperature(providerName),
    timeout: getTimeout(providerName),
  };

  if (modelName && isGPT5Model(modelName)) {
    return {
      ...baseParams,
      maxCompletionTokens: getMaxCompletionTokens(),
      verbosity: getVerbosity(),
      reasoningEffort: getReasoningEffort(),
    };
  } else {
    return {
      ...baseParams,
      maxTokens: getMaxTokens(providerName),
    };
  }
}

// ==========================================
// COMPREHENSIVE CONFIGURATION VALIDATION
// ==========================================

/**
 * Configuration validation rules and schemas
 */
export interface ConfigurationValidationRule {
  field: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "array";
  validator?: (value: any) => boolean;
  errorMessage?: string;
  dependencies?: string[];
}

/**
 * Provider-specific validation rules
 */
const PROVIDER_VALIDATION_RULES: Record<string, ConfigurationValidationRule[]> =
  {
    base: [
      {
        field: "apiKey",
        required: true,
        type: "string",
        validator: (value) => typeof value === "string" && value.length > 0,
        errorMessage: "API key must be a non-empty string",
      },
      {
        field: "model",
        required: true,
        type: "string",
        validator: (value) => typeof value === "string" && value.length > 0,
        errorMessage: "Model name must be a non-empty string",
      },
      {
        field: "temperature",
        required: true,
        type: "number",
        validator: (value) =>
          typeof value === "number" && value >= 0 && value <= 2,
        errorMessage: "Temperature must be a number between 0 and 2",
      },
      {
        field: "maxTokens",
        required: true,
        type: "number",
        validator: (value) =>
          typeof value === "number" && value > 0 && value <= 200000,
        errorMessage: "Max tokens must be a positive number up to 200,000",
      },
      {
        field: "timeout",
        required: true,
        type: "number",
        validator: (value) =>
          typeof value === "number" && value > 0 && value <= 300000,
        errorMessage:
          "Timeout must be a positive number up to 300,000ms (5 minutes)",
      },
    ],
    openai: [
      {
        field: "maxCompletionTokens",
        required: false,
        type: "number",
        validator: (value) =>
          value === undefined ||
          (typeof value === "number" && value > 0 && value <= 100000),
        errorMessage:
          "Max completion tokens must be a positive number up to 100,000",
      },
      {
        field: "verbosity",
        required: false,
        type: "string",
        validator: (value) =>
          value === undefined || ["low", "medium", "high"].includes(value),
        errorMessage: 'Verbosity must be "low", "medium", or "high"',
      },
      {
        field: "reasoningEffort",
        required: false,
        type: "string",
        validator: (value) =>
          value === undefined ||
          ["minimal", "low", "medium", "high"].includes(value),
        errorMessage:
          'Reasoning effort must be "minimal", "low", "medium", or "high"',
      },
    ],
  };

/**
 * Global configuration validation rules
 */
const GLOBAL_VALIDATION_RULES: ConfigurationValidationRule[] = [
  {
    field: "PROVIDER_SELECTION_PRIORITY",
    required: true,
    type: "string",
    validator: (value) => {
      if (!value || typeof value !== "string") return false;
      const providers = value
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      return (
        providers.length > 0 &&
        providers.every((p) => SUPPORTED_PROVIDERS.includes(p))
      );
    },
    errorMessage:
      "PROVIDER_SELECTION_PRIORITY must be a comma-separated list of valid providers",
  },
  {
    field: "DEFAULT_LLM_PROVIDER",
    required: true,
    type: "string",
    validator: (value) =>
      typeof value === "string" && SUPPORTED_PROVIDERS.includes(value),
    errorMessage: "DEFAULT_LLM_PROVIDER must be a valid provider name",
    dependencies: ["PROVIDER_SELECTION_PRIORITY"],
  },
];

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    category: ErrorCategory;
    provider?: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    provider?: string;
  }>;
}

/**
 * Comprehensive configuration validator
 */
export class ConfigurationValidator {
  /**
   * Validate a provider configuration
   */
  static validateProviderConfig(
    providerName: string,
    config: any
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Get validation rules for this provider
    const baseRules = PROVIDER_VALIDATION_RULES.base;
    const providerRules = PROVIDER_VALIDATION_RULES[providerName] || [];
    const allRules = [...baseRules, ...providerRules];

    // Validate each rule
    for (const rule of allRules) {
      const fieldValue = config[rule.field];

      // Check if required field is missing
      if (
        rule.required &&
        (fieldValue === undefined || fieldValue === null || fieldValue === "")
      ) {
        result.errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} is required`,
          category: ErrorCategory.CONFIGURATION,
          provider: providerName,
        });
        result.isValid = false;
        continue;
      }

      // Skip validation for optional missing fields
      if (!rule.required && (fieldValue === undefined || fieldValue === null)) {
        continue;
      }

      // Validate field type
      if (!this.validateType(fieldValue, rule.type)) {
        result.errors.push({
          field: rule.field,
          message: `${rule.field} must be of type ${rule.type}`,
          category: ErrorCategory.VALIDATION,
          provider: providerName,
        });
        result.isValid = false;
        continue;
      }

      // Run custom validator
      if (rule.validator && !rule.validator(fieldValue)) {
        result.errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} failed validation`,
          category: ErrorCategory.VALIDATION,
          provider: providerName,
        });
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Validate global configuration
   */
  static validateGlobalConfig(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Validate global rules
    for (const rule of GLOBAL_VALIDATION_RULES) {
      const fieldValue = process.env[rule.field];

      // Check if required field is missing
      if (rule.required && !fieldValue) {
        result.errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} is required`,
          category: ErrorCategory.CONFIGURATION,
        });
        result.isValid = false;
        continue;
      }

      // Skip validation for optional missing fields
      if (!rule.required && !fieldValue) {
        continue;
      }

      // Run custom validator
      if (rule.validator && !rule.validator(fieldValue)) {
        result.errors.push({
          field: rule.field,
          message: rule.errorMessage || `${rule.field} failed validation`,
          category: ErrorCategory.VALIDATION,
        });
        result.isValid = false;
      }
    }

    // Validate cross-dependencies
    this.validateCrossDependencies(result);

    return result;
  }

  /**
   * Validate all provider configurations
   */
  static validateAllProviders(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const configuredProviders = getConfiguredProviders();

    if (configuredProviders.length === 0) {
      result.errors.push({
        field: "providers",
        message:
          "No providers are configured. At least one provider with API key is required.",
        category: ErrorCategory.CONFIGURATION,
      });
      result.isValid = false;
      return result;
    }

    // Validate each configured provider
    for (const provider of configuredProviders) {
      if (!provider.hasApiKey) {
        result.warnings.push({
          field: "apiKey",
          message: `Provider ${provider.name} has no API key configured`,
          provider: provider.name,
        });
        continue;
      }

      try {
        const providerConfig = getUnifiedProviderConfig(provider.name);
        if (!providerConfig) {
          result.warnings.push({
            field: "configuration",
            message: `Could not load configuration for provider ${provider.name}`,
            provider: provider.name,
          });
          continue;
        }

        const providerValidation = this.validateProviderConfig(
          provider.name,
          providerConfig
        );

        // Merge results
        result.errors.push(...providerValidation.errors);
        result.warnings.push(...providerValidation.warnings);

        if (!providerValidation.isValid) {
          result.isValid = false;
        }
      } catch (error) {
        result.errors.push({
          field: "configuration",
          message: `Failed to validate provider ${provider.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          category: ErrorCategory.CONFIGURATION,
          provider: provider.name,
        });
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Comprehensive system validation
   */
  static validateSystem(): ValidationResult {
    const globalValidation = this.validateGlobalConfig();
    const providerValidation = this.validateAllProviders();

    return {
      isValid: globalValidation.isValid && providerValidation.isValid,
      errors: [...globalValidation.errors, ...providerValidation.errors],
      warnings: [...globalValidation.warnings, ...providerValidation.warnings],
    };
  }

  /**
   * Validate field type
   */
  private static validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "array":
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Validate cross-dependencies between configurations
   */
  private static validateCrossDependencies(result: ValidationResult): void {
    const defaultProvider = process.env.DEFAULT_LLM_PROVIDER;
    const providerPriority = process.env.PROVIDER_SELECTION_PRIORITY;

    // Validate default provider is in priority list
    if (defaultProvider && providerPriority) {
      const priorityProviders = providerPriority
        .split(",")
        .map((p) => p.trim());
      if (!priorityProviders.includes(defaultProvider)) {
        result.errors.push({
          field: "DEFAULT_LLM_PROVIDER",
          message:
            "DEFAULT_LLM_PROVIDER must be included in PROVIDER_SELECTION_PRIORITY",
          category: ErrorCategory.CONFIGURATION,
        });
        result.isValid = false;
      }
    }
  }
}

/**
 * Enhanced configuration validation function
 */
export function validateConfigurationComprehensive(): ValidationResult {
  return ConfigurationValidator.validateSystem();
}

/**
 * Format validation results for display
 */
export function formatValidationResults(result: ValidationResult): string {
  let output = "";

  if (result.isValid) {
    output += "[success] **Configuration Validation: PASSED**\n\n";
    if (result.warnings.length > 0) {
      output += `[warning] **${result.warnings.length} Warning(s) Found:**\n\n`;
      result.warnings.forEach((warning, index) => {
        output += `${index + 1}. **${
          warning.provider ? `[${warning.provider}] ` : ""
        }${warning.field}**: ${warning.message}\n`;
      });
    }
  } else {
    output += "[error] **Configuration Validation: FAILED**\n\n";
    output += `[error] **${result.errors.length} Error(s) Found:**\n\n`;

    result.errors.forEach((error, index) => {
      output += `${index + 1}. **${
        error.provider ? `[${error.provider}] ` : ""
      }${error.field}**: ${error.message}\n`;
    });

    if (result.warnings.length > 0) {
      output += `\n[warning] **${result.warnings.length} Warning(s) Found:**\n\n`;
      result.warnings.forEach((warning, index) => {
        output += `${index + 1}. **${
          warning.provider ? `[${warning.provider}] ` : ""
        }${warning.field}**: ${warning.message}\n`;
      });
    }
  }

  return output;
}

// ==========================================
// LEGACY CONFIGURATION VALIDATION (Updated)
// ==========================================

/**
 * Legacy interface for configuration validation results
 * @deprecated Use ValidationResult from comprehensive validation instead
 */
export interface LegacyValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Interface for validation issues
 */
export interface ValidationIssue {
  type: "error" | "warning" | "info";
  message: string;
  field?: string;
  suggestion?: string;
}

/**
 * Validate that no hardcoded provider references exist
 */
export function validateNoHardcodedProviders(): LegacyValidationResult {
  const issues: ValidationIssue[] = [];

  // Check for hardcoded provider fallbacks (already handled by our changes)
  // This is more of a documentation/validation function

  issues.push({
    type: "info",
    message:
      "Configuration validation: All provider selections are now environment-driven",
    suggestion: "Ensure DEFAULT_LLM_PROVIDER is set in your .env file",
  });

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
  };
}

/**
 * Validate GPT-5 parameter configuration
 */
export function validateGPT5Configuration(): LegacyValidationResult {
  const issues: ValidationIssue[] = [];

  // Check if GPT-5 parameters are properly configured
  const maxCompletionTokens = getMaxCompletionTokens();
  const verbosity = getVerbosity();
  const reasoningEffort = getReasoningEffort();

  if (maxCompletionTokens === null) {
    issues.push({
      type: "warning",
      message: "GPT-5 max completion tokens not configured",
      field: "OPENAI_MAX_COMPLETION_TOKENS",
      suggestion:
        "Set OPENAI_MAX_COMPLETION_TOKENS in your .env file (default: 5000)",
    });
  }

  if (verbosity === null) {
    issues.push({
      type: "warning",
      message: "GPT-5 verbosity not configured",
      field: "OPENAI_VERBOSITY",
      suggestion: "Set OPENAI_VERBOSITY in your .env file (low, medium, high)",
    });
  }

  if (reasoningEffort === null) {
    issues.push({
      type: "warning",
      message: "GPT-5 reasoning effort not configured",
      field: "OPENAI_REASONING_EFFORT",
      suggestion:
        "Set OPENAI_REASONING_EFFORT in your .env file (minimal, low, medium, high)",
    });
  }

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
  };
}

/**
 * Validate provider API key naming consistency
 */
export function validateProviderApiKeyConsistency(): LegacyValidationResult {
  const issues: ValidationIssue[] = [];

  // Check for deprecated naming patterns
  if (process.env.GOOGLE_AI_API_KEY) {
    issues.push({
      type: "warning",
      message: "Deprecated environment variable GOOGLE_AI_API_KEY detected",
      field: "GOOGLE_AI_API_KEY",
      suggestion:
        "Use GOOGLE_API_KEY instead for consistency with provider standards",
    });
  }

  // Check for both old and new naming patterns (conflict)
  if (process.env.GOOGLE_AI_API_KEY && process.env.GOOGLE_API_KEY) {
    issues.push({
      type: "warning",
      message: "Conflicting Google API key environment variables detected",
      suggestion: "Remove GOOGLE_AI_API_KEY and use only GOOGLE_API_KEY",
    });
  }

  // Check for other potential naming inconsistencies
  const deprecatedPatterns = [
    { old: "GOOGLE_AI_API_KEY", new: "GOOGLE_API_KEY" },
    // Add more deprecated patterns here as needed
  ];

  for (const pattern of deprecatedPatterns) {
    if (process.env[pattern.old]) {
      issues.push({
        type: "info",
        message: `Deprecated environment variable ${pattern.old} detected`,
        field: pattern.old,
        suggestion: `Use ${pattern.new} instead`,
      });
    }
  }

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
  };
}

/**
 * Validate provider configuration consistency
 */
export function validateProviderConfigurationConsistency(): LegacyValidationResult {
  const issues: ValidationIssue[] = [];

  // Check PROVIDER_SELECTION_PRIORITY for valid providers
  const priority = resolveEnvVariableCached("PROVIDER_SELECTION_PRIORITY");
  if (priority && priority.trim()) {
    const providers = priority
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Check if all providers in priority are supported
    for (const provider of providers) {
      if (!SUPPORTED_PROVIDERS.includes(provider)) {
        issues.push({
          type: "warning",
          message: `Unsupported provider '${provider}' in PROVIDER_SELECTION_PRIORITY`,
          field: "PROVIDER_SELECTION_PRIORITY",
          suggestion: `Remove '${provider}' or check spelling. Supported providers: ${SUPPORTED_PROVIDERS.join(
            ", "
          )}`,
        });
      }
    }
  }

  // Check DEFAULT_LLM_PROVIDER is in supported providers
  const defaultProvider = resolveEnvVariableCached("DEFAULT_LLM_PROVIDER");
  if (defaultProvider && defaultProvider.trim()) {
    const trimmedProvider = defaultProvider.trim();
    if (!SUPPORTED_PROVIDERS.includes(trimmedProvider)) {
      issues.push({
        type: "warning",
        message: `Unsupported DEFAULT_LLM_PROVIDER '${trimmedProvider}'`,
        field: "DEFAULT_LLM_PROVIDER",
        suggestion: `Check spelling. Supported providers: ${SUPPORTED_PROVIDERS.join(
          ", "
        )}`,
      });
    }
  }

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
  };
}

/**
 * Validate environment variable completeness
 */
export function validateEnvironmentCompleteness(): LegacyValidationResult {
  const issues: ValidationIssue[] = [];

  // Check DEFAULT_LLM_PROVIDER
  if (!process.env.DEFAULT_LLM_PROVIDER) {
    issues.push({
      type: "warning",
      message: "DEFAULT_LLM_PROVIDER not set",
      field: "DEFAULT_LLM_PROVIDER",
      suggestion:
        "Set DEFAULT_LLM_PROVIDER in your .env file to specify your preferred LLM provider",
    });
  }

  // Check for at least one API key
  const providers = getConfiguredProviders();
  const providersWithApiKeys = providers.filter((p) => p.hasApiKey);

  if (providersWithApiKeys.length === 0) {
    issues.push({
      type: "error",
      message: "No API keys configured",
      suggestion:
        "Configure at least one API key (e.g., OPENAI_API_KEY, ANTHROPIC_API_KEY) in your .env file",
    });
  }

  // Check for legacy OpenAI fallback
  // All provider selection must be explicit through environment configuration

  return {
    valid: issues.filter((i) => i.type === "error").length === 0,
    issues,
  };
}

/**
 * Comprehensive configuration validation
 */
export function validateConfiguration(): LegacyValidationResult {
  // Use comprehensive validation and convert to legacy format
  const comprehensiveResult = validateConfigurationComprehensive();

  const allIssues: ValidationIssue[] = [];

  // Convert errors to legacy issues format
  comprehensiveResult.errors.forEach((error) => {
    allIssues.push({
      type: "error",
      message: error.message,
      field: error.field,
      suggestion: `Check ${error.provider ? `[${error.provider}] ` : ""}${
        error.field
      } configuration`,
    });
  });

  // Convert warnings to legacy issues format
  comprehensiveResult.warnings.forEach((warning) => {
    allIssues.push({
      type: "warning",
      message: warning.message,
      field: warning.field,
      suggestion: `Consider reviewing ${
        warning.provider ? `[${warning.provider}] ` : ""
      }${warning.field} configuration`,
    });
  });

  return {
    valid: comprehensiveResult.isValid,
    issues: allIssues,
  };
}

/**
 * Print validation results to console
 */
export function printValidationResults(result: LegacyValidationResult): void {
  console.error("\nConfiguration Validation Results:");
  console.error("=====================================");

  if (result.valid) {
    console.error("Configuration is valid");
  } else {
    console.error("Configuration has issues");
  }

  if (result.issues.length === 0) {
    console.error("No issues found.");
  } else {
    result.issues.forEach((issue, index) => {
      const icon =
        issue.type === "error" ? "[error]" : issue.type === "warning" ? "[warning]" : "[info]";
      console.error(`${icon} ${issue.message}`);
      if (issue.field) {
        console.error(`   Field: ${issue.field}`);
      }
      if (issue.suggestion) {
        console.error(`   Suggestion: ${issue.suggestion}`);
      }
      if (index < result.issues.length - 1) {
        console.error("");
      }
    });
  }

  console.error("=====================================\n");
}

// ==========================================
// ENVIRONMENT-DRIVEN CONFIG LOADER (replacing llm-config.ts loadConfig)
// ==========================================

/**
 * Load AthenaProtocol configuration from environment variables only
 * NO DEFAULTS - everything must be explicitly configured
 * @throws {Error} When required configuration is missing
 */
export function loadConfig(): AthenaProtocolConfig {
  const config: AthenaProtocolConfig = {
    providers: [],
    memory: {
      maxShortTermEntries: 0,
      maxPersistentEntries: 0,
      compressionThreshold: 0,
      relevanceThreshold: 0,
    },
    logging: {
      enabled: false,
      level: "info",
      path: "",
    },
  };

  // Load providers configuration - enable only if API key is present and valid
  for (const providerName of SUPPORTED_PROVIDERS) {
    const envKey = `${providerName.toUpperCase()}_API_KEY`;
    const apiKey = process.env[envKey];

    if (apiKey && validateApiKey(providerName, apiKey)) {
      const provider: LLMProviderConfig = {
        name: providerName,
        enabled: true,
        apiKey: apiKey,
        model: "",
        maxTokens: 0,
        temperature: 0,
        timeout: 0,
      };

      // Load model from environment - REQUIRED
      try {
        provider.model = getModel(providerName);
      } catch (error) {
        // Re-throw StandardError as-is, convert others
        if (error instanceof StandardError) {
          throw error;
        }
        throw new StandardError({
          message: `Model configuration error for ${providerName}`,
          category: ErrorCategory.CONFIGURATION,
          code: "MODEL_LOAD_FAILED",
          provider: providerName,
          troubleshooting: getTroubleshootingHint(
            ErrorCategory.CONFIGURATION,
            providerName,
            { envVar: `${providerName.toUpperCase()}_MODEL` }
          ),
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      // Load provider parameters using existing functions
      try {
        provider.temperature = getTemperature(providerName);
        provider.maxTokens = getMaxTokens(providerName);
        provider.timeout = getTimeout(providerName);
      } catch (error) {
        // Re-throw StandardError as-is, convert others
        if (error instanceof StandardError) {
          throw error;
        }
        throw new StandardError({
          message: `Provider configuration error for ${providerName}`,
          category: ErrorCategory.CONFIGURATION,
          code: "PROVIDER_CONFIG_FAILED",
          provider: providerName,
          troubleshooting: `Check configuration for ${providerName}: temperature, max tokens, and timeout must be properly set.`,
          cause: error instanceof Error ? error : new Error(String(error)),
        });
      }

      // Load GPT-5 specific parameters for providers that support reasoning models
      if (providerSupportsFeature(providerName, "GPT5_REASONING")) {
        try {
          const maxCompletionTokens = getMaxCompletionTokens();
          if (maxCompletionTokens !== null) {
            provider.maxCompletionTokens = maxCompletionTokens;
          }
          const verbosity = getVerbosity();
          if (verbosity && ["low", "medium", "high"].includes(verbosity)) {
            provider.verbosity = verbosity as "low" | "medium" | "high";
          }
          const reasoningEffort = getReasoningEffort();
          if (
            reasoningEffort &&
            ["minimal", "low", "medium", "high"].includes(reasoningEffort)
          ) {
            provider.reasoningEffort = reasoningEffort as
              | "minimal"
              | "low"
              | "medium"
              | "high";
          }
        } catch (error) {
          // GPT-5 parameters are optional, continue if not set
        }
      }

      config.providers.push(provider);
    }
  }

  // Ensure at least one provider is configured
  if (config.providers.length === 0) {
    throw new StandardError({
      message: "No LLM providers configured",
      category: ErrorCategory.CONFIGURATION,
      code: "NO_PROVIDERS_CONFIGURED",
      troubleshooting: `Set at least one provider API key in your .env file. Examples: ${SUPPORTED_PROVIDERS.slice(
        0,
        3
      )
        .map((p) => `${p.toUpperCase()}_API_KEY`)
        .join(", ")}, etc. Then restart the application.`,
    });
  }

  // Load default provider - REQUIRED
  try {
    config.defaultProvider = getDefaultProvider();
  } catch (error) {
    // Re-throw StandardError as-is, convert others
    if (error instanceof StandardError) {
      throw error;
    }
    throw new StandardError({
      message: "Default provider configuration failed",
      category: ErrorCategory.CONFIGURATION,
      code: "DEFAULT_PROVIDER_LOAD_FAILED",
      troubleshooting: getTroubleshootingHint(
        ErrorCategory.CONFIGURATION,
        undefined,
        { envVar: "DEFAULT_LLM_PROVIDER" }
      ),
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }

  // Validate that default provider is configured
  const defaultProvider = config.providers.find(
    (p) => p.name === config.defaultProvider
  );
  if (!defaultProvider) {
    throw new StandardError({
      message: `Default provider ${config.defaultProvider} is not configured`,
      category: ErrorCategory.CONFIGURATION,
      code: "DEFAULT_PROVIDER_NOT_CONFIGURED",
      provider: config.defaultProvider,
      troubleshooting: `Set the API key for your default provider: ${config.defaultProvider.toUpperCase()}_API_KEY in your .env file. Then restart the application.`,
    });
  }

  // Load memory configuration - use environment variables directly
  const maxShortTermEnv = process.env.MEMORY_MAX_SHORT_TERM_ENTRIES;
  if (maxShortTermEnv) {
    const maxShortTerm = parseInt(maxShortTermEnv);
    if (!isNaN(maxShortTerm) && maxShortTerm > 0) {
      config.memory.maxShortTermEntries = maxShortTerm;
    }
  }

  const maxPersistentEnv = process.env.MEMORY_MAX_PERSISTENT_ENTRIES;
  if (maxPersistentEnv) {
    const maxPersistent = parseInt(maxPersistentEnv);
    if (!isNaN(maxPersistent) && maxPersistent > 0) {
      config.memory.maxPersistentEntries = maxPersistent;
    }
  }

  const compressionThresholdEnv = process.env.MEMORY_COMPRESSION_THRESHOLD;
  if (compressionThresholdEnv) {
    const compressionThreshold = parseFloat(compressionThresholdEnv);
    if (
      !isNaN(compressionThreshold) &&
      compressionThreshold >= 0 &&
      compressionThreshold <= 1
    ) {
      config.memory.compressionThreshold = compressionThreshold;
    }
  }

  const relevanceThresholdEnv = process.env.MEMORY_RELEVANCE_THRESHOLD;
  if (relevanceThresholdEnv) {
    const relevanceThreshold = parseFloat(relevanceThresholdEnv);
    if (
      !isNaN(relevanceThreshold) &&
      relevanceThreshold >= 0 &&
      relevanceThreshold <= 1
    ) {
      config.memory.relevanceThreshold = relevanceThreshold;
    }
  }

  // Load logging configuration
  if (process.env.LOG_ENABLED !== undefined) {
    config.logging.enabled = process.env.LOG_ENABLED.toLowerCase() === "true";
  }

  if (
    process.env.LOG_LEVEL &&
    ["debug", "info", "warn", "error"].includes(process.env.LOG_LEVEL)
  ) {
    config.logging.level = process.env.LOG_LEVEL as
      | "debug"
      | "info"
      | "warn"
      | "error";
  }

  if (process.env.LOG_PATH) {
    config.logging.path = process.env.LOG_PATH;
  }

  return config;
}

/**
 * Load tool calling configuration from environment variables
 */
export function loadToolCallingConfig(): ToolCallingConfig {
  // Parse allowed file extensions from env var
  const allowedExtensionsStr =
    process.env.TOOL_CALLING_ALLOWED_FILE_EXTENSIONS ||
    ".js,.jsx,.ts,.tsx,.mjs,.cjs,.d.ts,.d.tsx,.html,.htm,.xhtml,.css,.scss,.sass,.less,.styl,.vue,.svelte,.astro,.py,.pyc,.pyo,.pyd,.rb,.rbw,.php,.phtml,.java,.class,.cs,.csx,.go,.rs,.swift,.kt,.kts,.json,.jsonc,.yml,.yaml,.xml,.xsd,.toml,.ini,.cfg,.md,.markdown,.txt,.rst,.adoc,.tex,.package.json,.package-lock.json,.yarn.lock,.pnpm-lock.yaml,.requirements.txt,.pipfile,.Pipfile.lock,.Gemfile,.Gemfile.lock,.composer.json,.composer.lock,.pom.xml,.build.gradle,.gradle.kts,.csproj,.fsproj,.vbproj,.Cargo.toml,.Cargo.lock,.go.mod,.go.sum,.webpack,.babelrc,.eslintrc,.prettierrc,.dockerfile,.Dockerfile,.docker-compose.yml,.Makefile,.makefile,.sql,.prisma,.sh,.bash,.zsh,.ps1,.bat,.cmd";
  const allowedFileExtensions = allowedExtensionsStr
    .split(",")
    .map((ext) => ext.trim());

  // Parse allowed commands from env var
  const allowedCommandsStr =
    process.env.TOOL_CALLING_ALLOWED_COMMANDS ||
    "node --version,npm --version,python --version,pip --version,git --version,java -version,mvn --version,gradle --version,docker --version,echo,pwd,ls,dir,type,cat,head,tail,find,grep,wc,du,df,ps,uname,whoami,id,date,uptime,hostname,ping -c 1,ping -n 1,curl --version,wget --version,tar --version,zip --version,unzip -l,gzip --version,bzip2 --version,xz --version,make --version,gcc --version,g++ --version,clang --version,rustc --version,cargo --version,go version,dotnet --version,php --version,composer --version,ruby --version,gem --version,perl --version,sqlite3 --version,mysql --version,psql --version,redis-cli --version,mongo --version,kubectl version,helm version,docker-compose --version,kafka-topics.sh --version,zookeeper-shell.sh,elasticsearch --version,kibana --version,logstash --version";
  const allowedCommands = allowedCommandsStr
    .split(",")
    .map((cmd) => cmd.trim());

  return {
    readFile: {
      enabled: process.env.TOOL_CALLING_READ_FILE_ENABLED !== "false", // Default to enabled
    },
    grep: {
      enabled: process.env.TOOL_CALLING_GREP_ENABLED !== "false", // Default to enabled
    },
    listFiles: {
      enabled: process.env.TOOL_CALLING_LIST_FILES_ENABLED !== "false", // Default to enabled
    },
    writeToFile: {
      enabled: process.env.TOOL_CALLING_WRITE_TO_FILE_ENABLED === "true", // Default to disabled for security
    },
    replaceInFile: {
      enabled: process.env.TOOL_CALLING_REPLACE_IN_FILE_ENABLED === "true", // Default to disabled for security
    },
    executeCommand: {
      enabled: process.env.TOOL_CALLING_EXECUTE_COMMAND_ENABLED !== "false", // Default to enabled (as per ENV_REFERENCE)
    },
    // Security restrictions
    maxFileSizeKB: parseInt(
      process.env.TOOL_CALLING_MAX_FILE_SIZE_KB || "1024"
    ),
    maxExecutionTimeSec: parseInt(
      process.env.TOOL_CALLING_MAX_EXECUTION_TIME_SEC || "300"
    ),
    allowedFileExtensions,
    allowedCommands,
    // Tool-specific timeouts (in milliseconds)
    timeoutThinkingValidationMs: parseInt(
      process.env.TOOL_TIMEOUT_THINKING_VALIDATION_MS || "300000"
    ),
    timeoutImpactAnalysisMs: parseInt(
      process.env.TOOL_TIMEOUT_IMPACT_ANALYSIS_MS || "300000"
    ),
    timeoutAssumptionCheckerMs: parseInt(
      process.env.TOOL_TIMEOUT_ASSUMPTION_CHECKER_MS || "300000"
    ),
    timeoutDependencyMapperMs: parseInt(
      process.env.TOOL_TIMEOUT_DEPENDENCY_MAPPER_MS || "300000"
    ),
    timeoutThinkingOptimizerMs: parseInt(
      process.env.TOOL_TIMEOUT_THINKING_OPTIMIZER_MS || "300000"
    ),
  };
}

/**
 * Validate tool calling configuration
 */
export function validateToolCallingConfig(config: ToolCallingConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for required boolean values
  if (typeof config.readFile?.enabled !== "boolean") {
    errors.push("readFile.enabled must be a boolean");
  }
  if (typeof config.grep?.enabled !== "boolean") {
    errors.push("grep.enabled must be a boolean");
  }
  if (typeof config.listFiles?.enabled !== "boolean") {
    errors.push("listFiles.enabled must be a boolean");
  }
  if (typeof config.writeToFile?.enabled !== "boolean") {
    errors.push("writeToFile.enabled must be a boolean");
  }
  if (typeof config.replaceInFile?.enabled !== "boolean") {
    errors.push("replaceInFile.enabled must be a boolean");
  }
  if (typeof config.executeCommand?.enabled !== "boolean") {
    errors.push("executeCommand.enabled must be a boolean");
  }

  // Security warnings for dangerous operations
  if (config.writeToFile.enabled) {
    console.error(
      "[warning] WARNING: File writing is enabled - this poses security risks"
    );
  }
  if (config.replaceInFile.enabled) {
    console.error(
      "[warning] WARNING: File replacement is enabled - this poses security risks"
    );
  }
  if (config.executeCommand.enabled) {
    console.error(
      "[warning] WARNING: Command execution is enabled - this poses CRITICAL security risks"
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
