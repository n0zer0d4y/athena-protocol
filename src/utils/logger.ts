/**
 * Logger Utility - Centralized logging functionality for MCP server
 *
 * Provides consistent logging across the Athena Protocol MCP Server with support for
 * different log levels (info, error, warn, debug). Includes environment-based debug output
 * control and standardized message formatting for development and production use.
 */

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.DEBUG === 'true') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
};