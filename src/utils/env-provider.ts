/**
 * Environment Provider Abstraction
 * Supports multiple sources of environment variables with priority ordering
 */

export interface EnvironmentProvider {
  get(key: string): string | undefined;
  has(key: string): boolean;
  getAll(): Record<string, string>;
}

/**
 * Process environment provider - uses Node.js process.env
 */
export class ProcessEnvProvider implements EnvironmentProvider {
  get(key: string): string | undefined {
    return process.env[key];
  }

  has(key: string): boolean {
    return key in process.env;
  }

  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }
}

/**
 * Dotenv file provider - loads from .env file
 */
export class DotenvProvider implements EnvironmentProvider {
  private envVars: Record<string, string> = {};

  constructor(envVars: Record<string, string> = {}) {
    this.envVars = { ...envVars };
  }

  get(key: string): string | undefined {
    return this.envVars[key];
  }

  has(key: string): boolean {
    return key in this.envVars;
  }

  getAll(): Record<string, string> {
    return { ...this.envVars };
  }

  setVars(vars: Record<string, string>): void {
    this.envVars = { ...vars };
  }
}

/**
 * Merged environment provider with priority ordering
 * Primary source takes precedence over fallback sources
 */
export class MergedEnvProvider implements EnvironmentProvider {
  constructor(
    private primary: EnvironmentProvider,
    private fallback: EnvironmentProvider
  ) {}

  get(key: string): string | undefined {
    return this.primary.get(key) ?? this.fallback.get(key);
  }

  has(key: string): boolean {
    return this.primary.has(key) || this.fallback.has(key);
  }

  getAll(): Record<string, string> {
    return { ...this.fallback.getAll(), ...this.primary.getAll() };
  }
}

/**
 * Triple-merged provider for MCP env → .env → process.env hierarchy
 */
export class TripleMergedEnvProvider implements EnvironmentProvider {
  constructor(
    private mcpEnv: EnvironmentProvider,
    private dotenvEnv: EnvironmentProvider,
    private processEnv: EnvironmentProvider
  ) {}

  get(key: string): string | undefined {
    return this.mcpEnv.get(key) ?? this.dotenvEnv.get(key) ?? this.processEnv.get(key);
  }

  has(key: string): boolean {
    return this.mcpEnv.has(key) || this.dotenvEnv.has(key) || this.processEnv.has(key);
  }

  getAll(): Record<string, string> {
    return {
      ...this.processEnv.getAll(),
      ...this.dotenvEnv.getAll(),
      ...this.mcpEnv.getAll()
    };
  }
}
