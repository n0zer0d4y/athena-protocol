// Retry logic utility for LLM provider calls
// Addresses MCP server reliability issues identified in audit

import { PerformanceTracker } from "./performance-monitor.js";

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504], // Rate limit, server errors
  retryableErrors: [
    "ECONNRESET",
    "ENOTFOUND",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "timeout",
    "network",
    "temporarily unavailable",
  ],
};

export interface RetryAttempt {
  attempt: number;
  error: Error;
  delay: number;
  timestamp: Date;
}

export class RetryableError extends Error {
  public readonly statusCode?: number;
  public readonly retryAfter?: number;
  public readonly attempts: RetryAttempt[] = [];

  constructor(message: string, statusCode?: number, retryAfter?: number) {
    super(message);
    this.name = "RetryableError";
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

export class NonRetryableError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "NonRetryableError";
    this.statusCode = statusCode;
  }
}

export function isRetryableError(error: any, config: RetryConfig): boolean {
  // Check if it's explicitly marked as non-retryable
  if (error instanceof NonRetryableError) {
    return false;
  }

  // Check HTTP status codes
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;
    if (status === 401 || status === 403) {
      // Auth errors are not retryable
      return false;
    }
    return config.retryableStatusCodes.includes(status);
  }

  // Check error messages
  const errorMessage = (error as Error).message?.toLowerCase() || "";
  return config.retryableErrors.some((pattern) =>
    errorMessage.includes(pattern.toLowerCase())
  );
}

export function calculateDelay(
  attempt: number,
  config: RetryConfig,
  retryAfter?: number
): number {
  // Use retry-after header if provided
  if (retryAfter && retryAfter > 0) {
    return Math.min(retryAfter * 1000, config.maxDelay);
  }

  // Exponential backoff with jitter
  const exponentialDelay =
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay; // ±10% jitter
  const totalDelay = exponentialDelay + jitter;

  return Math.min(totalDelay, config.maxDelay);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operationName: string = "operation",
  performanceTracker?: PerformanceTracker
): Promise<T> {
  const attempts: RetryAttempt[] = [];

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();

      // Update performance tracker with retry count
      if (performanceTracker) {
        performanceTracker.setRetryAttempts(attempts.length);
      }

      // Log success if there were previous failures
      if (attempts.length > 0) {
        console.log(
          `✅ ${operationName} succeeded on attempt ${attempt} after ${attempts.length} retries`
        );
      }

      return result;
    } catch (error) {
      const attemptInfo: RetryAttempt = {
        attempt,
        error: error as Error,
        delay: 0,
        timestamp: new Date(),
      };
      attempts.push(attemptInfo);

      // Check if this is the last attempt
      if (attempt === config.maxAttempts) {
        // Update performance tracker with final retry count and error
        if (performanceTracker) {
          performanceTracker.setRetryAttempts(attempts.length);
        }

        console.error(
          `❌ ${operationName} failed after ${config.maxAttempts} attempts:`,
          {
            attempts: attempts.map((a) => ({
              attempt: a.attempt,
              error: (a.error as Error).message,
              timestamp: a.timestamp,
            })),
          }
        );

        // Throw the original error with retry context
        const finalError = new RetryableError(
          `${operationName} failed after ${config.maxAttempts} attempts: ${
            (error as Error).message
          }`,
          (error as any).status || (error as any).statusCode
        );
        finalError.attempts.push(...attempts);
        throw finalError;
      }

      // Check if error is retryable
      if (!isRetryableError(error, config)) {
        // Update performance tracker for non-retryable error
        if (performanceTracker) {
          performanceTracker.setRetryAttempts(attempts.length);
        }

        console.error(
          `❌ ${operationName} failed with non-retryable error:`,
          (error as Error).message
        );
        throw new NonRetryableError(
          (error as Error).message,
          (error as any).status || (error as any).statusCode
        );
      }

      // Calculate delay for next attempt
      const retryAfter =
        (error as any).retryAfter || (error as any)["retry-after"];
      const delay = calculateDelay(attempt, config, retryAfter);
      attemptInfo.delay = delay;

      console.warn(
        `⚠️ ${operationName} attempt ${attempt} failed, retrying in ${delay}ms:`,
        (error as Error).message
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error(`Unexpected error in retry logic for ${operationName}`);
}

// Provider-specific retry configurations
export const PROVIDER_RETRY_CONFIGS: Record<string, Partial<RetryConfig>> = {
  openai: {
    maxAttempts: 3,
    baseDelay: 1000,
    retryableStatusCodes: [429, 500, 502, 503, 504],
  },
  anthropic: {
    maxAttempts: 3,
    baseDelay: 2000, // Anthropic tends to need longer delays
    retryableStatusCodes: [429, 500, 502, 503, 504],
  },
  google: {
    maxAttempts: 3,
    baseDelay: 1500,
    retryableStatusCodes: [429, 500, 502, 503, 504],
  },
  openrouter: {
    maxAttempts: 4, // OpenRouter may need more attempts due to underlying provider variety
    baseDelay: 2000,
    retryableStatusCodes: [429, 500, 502, 503, 504],
  },
  qwen: {
    maxAttempts: 3,
    baseDelay: 1000,
    retryableStatusCodes: [429, 500, 502, 503, 504],
  },
};

export function getRetryConfigForProvider(providerName: string): RetryConfig {
  const baseConfig = DEFAULT_RETRY_CONFIG;
  const providerOverrides = PROVIDER_RETRY_CONFIGS[providerName] || {};

  return {
    ...baseConfig,
    ...providerOverrides,
  };
}
