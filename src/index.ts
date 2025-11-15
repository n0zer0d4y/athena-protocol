#!/usr/bin/env node

// Silence AI SDK warnings BEFORE any imports (temperature not supported for reasoning models)
// @ts-ignore - Setting global before AI SDK loads
globalThis.AI_SDK_LOG_WARNINGS = false;

// Ensure we load dotenv from the correct location (relative to this script)
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import dotenv from "dotenv";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Project root is one level up from the dist directory
const projectRoot = join(__dirname, "..");

/**
 * Detect if running in MCP server mode with environment variables from client
 */
function detectMCPServerMode(): boolean {
  // Check for indicators of MCP server usage
  const hasMCPEnvVars = Object.keys(process.env).some(key =>
    key.startsWith('DEFAULT_LLM_PROVIDER') ||
    key.startsWith('PROVIDER_SELECTION_PRIORITY') ||
    key.includes('API_KEY') ||
    key.includes('_MODEL')
  );

  // Check if running via npx by looking for npm cache paths
  const isNPX = __filename.includes('_npx') ||
                __filename.includes('.npm') ||
                process.cwd().includes('_npx') ||
                process.cwd().includes('.npm');

  return isNPX || hasMCPEnvVars;
}

/**
 * Load environment variables with MCP client support
 * Supports both .env files (legacy) and MCP client env configuration
 */
function initializeEnvironmentProvider(): EnvironmentProvider {
  const mcpProvider = new ProcessEnvProvider(); // MCP env vars come via process.env
  const processProvider = new ProcessEnvProvider(); // System env vars

  // Check if running via npx (npm-published usage)
  const isNPX = __filename.includes('_npx') ||
                __filename.includes('.npm') ||
                process.cwd().includes('_npx') ||
                process.cwd().includes('.npm') ||
                process.argv.some(arg => arg.includes('npx'));
  const isNPM = process.argv.some(arg => arg.includes('npm') && !arg.includes('npx'));

  // Debug logging for troubleshooting (only show essential info)
  if (isNPX) {
    console.error(`Running via npx - using MCP environment variables only`);
    console.error(`Configure all settings in your MCP client's env field`);
  }

  let dotenvProvider = new DotenvProvider();

  if (isNPX) {
    // For npx usage, completely skip .env loading - rely on MCP env vars only
    console.error("Running via npx - using MCP environment variables only");
    console.error("Configure all settings in your MCP client's env field");
  } else {
    // For local installations, try to load .env file (optional for backward compatibility)
    try {
      const envPath = join(projectRoot, ".env");
      if (existsSync(envPath)) {
        console.error(`Loading .env from: ${envPath}`);
        const result = dotenv.config({ path: envPath });

        if (result.error) {
          console.warn(`Warning: Failed to parse .env file: ${result.error.message}`);
          console.warn("Continuing with MCP environment variables only...");
        } else {
          dotenvProvider.setVars(result.parsed || {});
          console.error(
            `Successfully loaded .env with ${
              Object.keys(result.parsed || {}).length
            } variables`
          );
        }
      } else if (!isNPM && !detectMCPServerMode()) {
        // Only warn about missing .env if not in any special mode
        console.warn("No .env file found. If you're not using MCP client configuration,");
        console.warn("please create a .env file in the project root with your API keys.");
      }
    } catch (error) {
      console.warn(`Warning: Error loading .env file: ${(error as Error).message}`);
      console.warn("Continuing with MCP environment variables only...");
    }
  }

  // Create merged provider with priority: MCP env → .env → system env
  const mergedProvider = new TripleMergedEnvProvider(
    mcpProvider,     // Highest priority (MCP client env vars)
    dotenvProvider,  // Middle priority (.env file) - empty for npx
    processProvider  // Lowest priority (system env)
  );

  return mergedProvider;
}

// Initialize environment provider with MCP support
const envProvider = initializeEnvironmentProvider();
setEnvironmentProvider(envProvider);

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
  loadConfig,
  loadToolCallingConfig,
  validateToolCallingConfig,
  setEnvironmentProvider,
} from "./config-manager.js";
import { ThinkingValidator } from "./core/thinking-validator.js";
import { HEALTH_CHECK_TOOL } from "./client-tools/simple-health-check.js";
import { ToolCallingService } from "./services/tool-calling-service.js";
import {
  getConfiguredProviders,
  validateConfiguration,
  printValidationResults,
} from "./config-manager.js";
import { SUPPORTED_PROVIDERS } from "./ai-providers/index.js";
import {
  EnvironmentProvider,
  ProcessEnvProvider,
  DotenvProvider,
  TripleMergedEnvProvider
} from "./utils/env-provider.js";

/**
 * Safely get the default provider description suffix for tool schemas
 * This reads directly from environment to avoid load-order issues
 */
function getDefaultProviderDescription(): string {
  try {
    const defaultProvider = process.env.DEFAULT_LLM_PROVIDER?.trim();
    if (defaultProvider && defaultProvider.length > 0) {
      return ` (default: ${defaultProvider})`;
    }
    return ""; // No default set, don't show anything
  } catch (error) {
    console.warn(
      "Warning: Could not determine default provider for tool descriptions"
    );
    return ""; // Fallback to empty string
  }
}

// Tool definitions for the Athena Protocol MCP Server
const THINKING_VALIDATION_TOOL: Tool = {
  name: "thinking_validation",
  description:
    "Validate the primary agent's thinking process with focused, essential information. Returns validation analysis with confidence score, critical issues, recommendations, and test cases.",
  inputSchema: {
    type: "object",
    properties: {
      thinking: {
        type: "string",
        description: "Brief explanation of the approach and reasoning",
      },
      proposedChange: {
        type: "object",
        description: "Details of the proposed change",
        properties: {
          description: {
            type: "string",
            description: "What will be changed",
          },
          code: {
            type: "string",
            description: "The actual code change (before/after or new code)",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Files that will be affected",
          },
        },
        required: ["description"],
      },
      context: {
        type: "object",
        description: "Context for the validation",
        properties: {
          problem: {
            type: "string",
            description: "Brief problem description",
          },
          techStack: {
            type: "string",
            description: "Technology stack (react|node|python etc)",
          },
          constraints: {
            type: "array",
            items: { type: "string" },
            description:
              "Key constraints like performance, backward compatibility",
          },
        },
        required: ["problem", "techStack"],
      },
      urgency: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Urgency level",
      },
      sessionId: {
        type: "string",
        description: "Optional session ID for context persistence",
      },
      provider: {
        type: "string",
        enum: SUPPORTED_PROVIDERS,
        description: `LLM provider to use${getDefaultProviderDescription()}`,
      },
      projectContext: {
        type: "object",
        description:
          "Optional project context for enhanced file-based analysis",
        properties: {
          projectRoot: {
            type: "string",
            description: "Absolute path to the project root directory",
          },
          filesToAnalyze: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of absolute file paths to analyze (backward compatible)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
          analysisTargets: {
            type: "array",
            description:
              "Specific code sections to analyze with mode support (NEW: client-driven targeting)",
            items: {
              type: "object",
              properties: {
                file: {
                  type: "string",
                  description: "File path (relative or absolute)",
                },
                mode: {
                  type: "string",
                  enum: ["full", "head", "tail", "range"],
                  description: "'full'=when issue area unclear, 'head'=imports/setup, 'tail'=recent changes, 'range'=known lines",
                },
                lines: {
                  type: "number",
                  description: "Number of lines (for head/tail modes)",
                },
                startLine: {
                  type: "number",
                  description: "Start line number (1-indexed, for range mode)",
                },
                endLine: {
                  type: "number",
                  description: "End line number (1-indexed, for range mode)",
                },
                priority: {
                  type: "string",
                  enum: ["critical", "important", "supplementary"],
                  description: "Priority for analysis focus",
                },
              },
              required: ["file"],
            },
          },
        },
        required: ["projectRoot"],
      },
      projectBackground: {
        type: "string",
        description:
          "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination",
      },
    },
    required: [
      "thinking",
      "proposedChange",
      "context",
      "urgency",
      "projectContext",
      "projectBackground",
    ],
  },
};

const IMPACT_ANALYSIS_TOOL: Tool = {
  name: "impact_analysis",
  description:
    "Quickly identify key impacts of proposed changes. Returns impact analysis with overall risk assessment, affected areas, cascading risks, and essential tests.",
  inputSchema: {
    type: "object",
    properties: {
      change: {
        type: "object",
        description: "Details of the change",
        properties: {
          description: {
            type: "string",
            description: "What is being changed",
          },
          code: {
            type: "string",
            description: "The code change",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Affected files",
          },
        },
        required: ["description"],
      },
      systemContext: {
        type: "object",
        description: "System context for impact analysis",
        properties: {
          architecture: {
            type: "string",
            description: "Brief architecture description",
          },
          keyDependencies: {
            type: "array",
            items: { type: "string" },
            description: "Key dependencies",
          },
        },
      },
      sessionId: {
        type: "string",
        description: "Optional session ID for context persistence",
      },
      provider: {
        type: "string",
        enum: SUPPORTED_PROVIDERS,
        description: `LLM provider to use${getDefaultProviderDescription()}`,
      },
      projectContext: {
        type: "object",
        description: "Project context for enhanced file-based analysis",
        properties: {
          projectRoot: {
            type: "string",
            description: "Absolute path to the project root directory",
          },
          filesToAnalyze: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of absolute file paths to analyze (backward compatible)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
          analysisTargets: {
            type: "array",
            description:
              "Specific code sections to analyze with mode support (NEW: client-driven targeting)",
            items: {
              type: "object",
              properties: {
                file: {
                  type: "string",
                  description: "File path (relative or absolute)",
                },
                mode: {
                  type: "string",
                  enum: ["full", "head", "tail", "range"],
                  description: "'full'=when issue area unclear, 'head'=imports/setup, 'tail'=recent changes, 'range'=known lines",
                },
                lines: {
                  type: "number",
                  description: "Number of lines (for head/tail modes)",
                },
                startLine: {
                  type: "number",
                  description: "Start line number (1-indexed, for range mode)",
                },
                endLine: {
                  type: "number",
                  description: "End line number (1-indexed, for range mode)",
                },
                priority: {
                  type: "string",
                  enum: ["critical", "important", "supplementary"],
                  description: "Priority for analysis focus",
                },
              },
              required: ["file"],
            },
          },
        },
        required: ["projectRoot"],
      },
      projectBackground: {
        type: "string",
        description:
          "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination",
      },
    },
    required: ["change", "projectContext", "projectBackground"],
  },
};

const ASSUMPTION_CHECKER_TOOL: Tool = {
  name: "assumption_checker",
  description:
    "Rapidly validate key assumptions without over-analysis. Returns validation results categorizing assumptions as valid or risky with mitigation strategies.",
  inputSchema: {
    type: "object",
    properties: {
      assumptions: {
        type: "array",
        items: { type: "string" },
        description: "List of assumptions to validate",
      },
      context: {
        type: "object",
        description: "Context for assumption validation",
        properties: {
          component: {
            type: "string",
            description: "Component name",
          },
          environment: {
            type: "string",
            description: "Environment (production, development, etc.)",
          },
        },
        required: ["component", "environment"],
      },
      sessionId: {
        type: "string",
        description: "Optional session ID for context persistence",
      },
      provider: {
        type: "string",
        enum: SUPPORTED_PROVIDERS,
        description: `LLM provider to use${getDefaultProviderDescription()}`,
      },
      projectContext: {
        type: "object",
        description: "Project context for enhanced file-based analysis",
        properties: {
          projectRoot: {
            type: "string",
            description: "Absolute path to the project root directory",
          },
          filesToAnalyze: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of absolute file paths to analyze (backward compatible)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
          analysisTargets: {
            type: "array",
            description:
              "Specific code sections to analyze with mode support (NEW: client-driven targeting)",
            items: {
              type: "object",
              properties: {
                file: {
                  type: "string",
                  description: "File path (relative or absolute)",
                },
                mode: {
                  type: "string",
                  enum: ["full", "head", "tail", "range"],
                  description: "'full'=when issue area unclear, 'head'=imports/setup, 'tail'=recent changes, 'range'=known lines",
                },
                lines: {
                  type: "number",
                  description: "Number of lines (for head/tail modes)",
                },
                startLine: {
                  type: "number",
                  description: "Start line number (1-indexed, for range mode)",
                },
                endLine: {
                  type: "number",
                  description: "End line number (1-indexed, for range mode)",
                },
                priority: {
                  type: "string",
                  enum: ["critical", "important", "supplementary"],
                  description: "Priority for analysis focus",
                },
              },
              required: ["file"],
            },
          },
        },
        required: ["projectRoot"],
      },
      projectBackground: {
        type: "string",
        description:
          "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination",
      },
    },
    required: ["assumptions", "context", "projectContext", "projectBackground"],
  },
};

const DEPENDENCY_MAPPER_TOOL: Tool = {
  name: "dependency_mapper",
  description:
    "Identify critical dependencies efficiently. Returns dependency analysis categorizing critical and secondary dependencies with impact assessment and testing recommendations.",
  inputSchema: {
    type: "object",
    properties: {
      change: {
        type: "object",
        description: "Details of the change",
        properties: {
          description: {
            type: "string",
            description: "Brief change description",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Files being modified",
          },
          components: {
            type: "array",
            items: { type: "string" },
            description: "Components being changed",
          },
        },
        required: ["description"],
      },
      sessionId: {
        type: "string",
        description: "Optional session ID for context persistence",
      },
      provider: {
        type: "string",
        enum: SUPPORTED_PROVIDERS,
        description: `LLM provider to use${getDefaultProviderDescription()}`,
      },
      projectContext: {
        type: "object",
        description: "Project context for enhanced file-based analysis",
        properties: {
          projectRoot: {
            type: "string",
            description: "Absolute path to the project root directory",
          },
          filesToAnalyze: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of absolute file paths to analyze (backward compatible)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
          analysisTargets: {
            type: "array",
            description:
              "Specific code sections to analyze with mode support (NEW: client-driven targeting)",
            items: {
              type: "object",
              properties: {
                file: {
                  type: "string",
                  description: "File path (relative or absolute)",
                },
                mode: {
                  type: "string",
                  enum: ["full", "head", "tail", "range"],
                  description: "'full'=when issue area unclear, 'head'=imports/setup, 'tail'=recent changes, 'range'=known lines",
                },
                lines: {
                  type: "number",
                  description: "Number of lines (for head/tail modes)",
                },
                startLine: {
                  type: "number",
                  description: "Start line number (1-indexed, for range mode)",
                },
                endLine: {
                  type: "number",
                  description: "End line number (1-indexed, for range mode)",
                },
                priority: {
                  type: "string",
                  enum: ["critical", "important", "supplementary"],
                  description: "Priority for analysis focus",
                },
              },
              required: ["file"],
            },
          },
        },
        required: ["projectRoot"],
      },
      projectBackground: {
        type: "string",
        description:
          "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination",
      },
    },
    required: ["change", "projectContext", "projectBackground"],
  },
};

const THINKING_OPTIMIZER_TOOL: Tool = {
  name: "thinking_optimizer",
  description:
    "Optimize thinking approach based on problem type. Returns optimized strategy with recommended approach, tools to use, time allocation, and success probability.",
  inputSchema: {
    type: "object",
    properties: {
      problemType: {
        type: "string",
        enum: ["bug_fix", "feature_impl", "refactor"],
        description: "Type of problem being solved",
      },
      complexity: {
        type: "string",
        enum: ["simple", "moderate", "complex"],
        description: "Complexity level",
      },
      timeConstraint: {
        type: "string",
        enum: ["tight", "moderate", "flexible"],
        description: "Time constraint",
      },
      currentApproach: {
        type: "string",
        description: "Brief description of current thinking",
      },
      sessionId: {
        type: "string",
        description: "Optional session ID for context persistence",
      },
      provider: {
        type: "string",
        enum: SUPPORTED_PROVIDERS,
        description: `LLM provider to use${getDefaultProviderDescription()}`,
      },
      projectContext: {
        type: "object",
        description: "Project context for enhanced file-based analysis",
        properties: {
          projectRoot: {
            type: "string",
            description: "Absolute path to the project root directory",
          },
          filesToAnalyze: {
            type: "array",
            items: { type: "string" },
            description:
              "Array of absolute file paths to analyze (backward compatible)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
          analysisTargets: {
            type: "array",
            description:
              "Specific code sections to analyze with mode support (NEW: client-driven targeting)",
            items: {
              type: "object",
              properties: {
                file: {
                  type: "string",
                  description: "File path (relative or absolute)",
                },
                mode: {
                  type: "string",
                  enum: ["full", "head", "tail", "range"],
                  description: "'full'=when issue area unclear, 'head'=imports/setup, 'tail'=recent changes, 'range'=known lines",
                },
                lines: {
                  type: "number",
                  description: "Number of lines (for head/tail modes)",
                },
                startLine: {
                  type: "number",
                  description: "Start line number (1-indexed, for range mode)",
                },
                endLine: {
                  type: "number",
                  description: "End line number (1-indexed, for range mode)",
                },
                priority: {
                  type: "string",
                  enum: ["critical", "important", "supplementary"],
                  description: "Priority for analysis focus",
                },
              },
              required: ["file"],
            },
          },
        },
        required: ["projectRoot"],
      },
      projectBackground: {
        type: "string",
        description:
          "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination",
      },
    },
    required: [
      "problemType",
      "complexity",
      "timeConstraint",
      "currentApproach",
      "projectContext",
      "projectBackground",
    ],
  },
};

// Using the consolidated health check tool from simple-health-check.ts

// PROVIDERS_TOOL removed - functionality consolidated into health_check tool

/**
 * Parameter validation utilities for MCP tool handlers
 */
class ToolParameterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolParameterError";
  }
}

function validateThinkingValidationParams(args: any): {
  thinking: string;
  proposedChange: any;
  context: any;
  urgency: string;
  projectContext: any;
  projectBackground: string;
  sessionId?: string;
  provider?: string;
} {
  // Required parameters validation
  if (!args.thinking || typeof args.thinking !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'thinking' must be a non-empty string"
    );
  }
  if (!args.proposedChange || typeof args.proposedChange !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'proposedChange' must be an object"
    );
  }
  if (!args.context || typeof args.context !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'context' must be an object"
    );
  }
  if (!args.urgency || !["low", "medium", "high"].includes(args.urgency)) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'urgency' must be one of 'low', 'medium', 'high'"
    );
  }
  if (!args.projectContext || typeof args.projectContext !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext' must be an object"
    );
  }
  if (
    !args.projectContext.projectRoot ||
    typeof args.projectContext.projectRoot !== "string"
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.projectRoot' must be a string"
    );
  }
  if (!args.projectBackground || typeof args.projectBackground !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectBackground' must be a non-empty string"
    );
  }

  return {
    thinking: args.thinking,
    proposedChange: args.proposedChange,
    context: args.context,
    urgency: args.urgency,
    projectContext: args.projectContext,
    projectBackground: args.projectBackground,
    sessionId: args.sessionId,
    provider: args.provider,
  };
}

function validateImpactAnalysisParams(args: any): {
  change: any;
  systemContext: any;
  projectContext: any;
  projectBackground: string;
  sessionId?: string;
  provider?: string;
} {
  if (!args.change || typeof args.change !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'change' must be an object"
    );
  }
  if (!args.systemContext || typeof args.systemContext !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'systemContext' must be an object"
    );
  }
  if (!args.projectContext || typeof args.projectContext !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext' must be an object"
    );
  }
  if (
    !args.projectContext.projectRoot ||
    typeof args.projectContext.projectRoot !== "string"
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.projectRoot' must be a string"
    );
  }
  if (!args.projectBackground || typeof args.projectBackground !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectBackground' must be a non-empty string"
    );
  }

  return {
    change: args.change,
    systemContext: args.systemContext,
    projectContext: args.projectContext,
    projectBackground: args.projectBackground,
    sessionId: args.sessionId,
    provider: args.provider,
  };
}

function validateAssumptionCheckerParams(args: any): {
  assumptions: string[];
  context: any;
  projectContext: any;
  projectBackground: string;
  sessionId?: string;
  provider?: string;
} {
  if (
    !args.assumptions ||
    !Array.isArray(args.assumptions) ||
    args.assumptions.length === 0
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'assumptions' must be a non-empty array of strings"
    );
  }
  if (!args.context || typeof args.context !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'context' must be an object"
    );
  }
  if (!args.context.component || typeof args.context.component !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'context.component' must be a string"
    );
  }
  if (
    !args.context.environment ||
    !["production", "development", "staging", "testing"].includes(
      args.context.environment
    )
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'context.environment' must be one of 'production', 'development', 'staging', 'testing'"
    );
  }
  if (!args.projectContext || typeof args.projectContext !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext' must be an object"
    );
  }
  if (
    !args.projectContext.projectRoot ||
    typeof args.projectContext.projectRoot !== "string"
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.projectRoot' must be a string"
    );
  }
  if (!args.projectBackground || typeof args.projectBackground !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectBackground' must be a non-empty string"
    );
  }

  return {
    assumptions: args.assumptions,
    context: args.context,
    projectContext: args.projectContext,
    projectBackground: args.projectBackground,
    sessionId: args.sessionId,
    provider: args.provider,
  };
}

function validateDependencyMapperParams(args: any): {
  change: any;
  projectContext: any;
  projectBackground: string;
  sessionId?: string;
  provider?: string;
} {
  if (!args.change || typeof args.change !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'change' must be an object"
    );
  }
  if (!args.change.description || typeof args.change.description !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'change.description' must be a string"
    );
  }
  if (!args.projectContext || typeof args.projectContext !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext' must be an object"
    );
  }
  if (
    !args.projectContext.projectRoot ||
    typeof args.projectContext.projectRoot !== "string"
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.projectRoot' must be a string"
    );
  }
  if (!args.projectBackground || typeof args.projectBackground !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectBackground' must be a non-empty string"
    );
  }

  return {
    change: args.change,
    projectContext: args.projectContext,
    projectBackground: args.projectBackground,
    sessionId: args.sessionId,
    provider: args.provider,
  };
}

function validateThinkingOptimizerParams(args: any): {
  problemType: string;
  complexity: string;
  timeConstraint: string;
  currentApproach: string;
  projectContext: any;
  projectBackground: string;
  sessionId?: string;
  provider?: string;
} {
  if (
    !args.problemType ||
    !["bug_fix", "feature_impl", "refactor"].includes(args.problemType)
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'problemType' must be one of 'bug_fix', 'feature_impl', 'refactor'"
    );
  }
  if (
    !args.complexity ||
    !["simple", "moderate", "complex"].includes(args.complexity)
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'complexity' must be one of 'simple', 'moderate', 'complex'"
    );
  }
  if (
    !args.timeConstraint ||
    !["tight", "moderate", "flexible"].includes(args.timeConstraint)
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'timeConstraint' must be one of 'tight', 'moderate', 'flexible'"
    );
  }
  if (!args.currentApproach || typeof args.currentApproach !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'currentApproach' must be a non-empty string"
    );
  }
  if (!args.projectContext || typeof args.projectContext !== "object") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext' must be an object"
    );
  }
  if (
    !args.projectContext.projectRoot ||
    typeof args.projectContext.projectRoot !== "string"
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.projectRoot' must be a string"
    );
  }
  if (!args.projectBackground || typeof args.projectBackground !== "string") {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectBackground' must be a non-empty string"
    );
  }

  return {
    problemType: args.problemType,
    complexity: args.complexity,
    timeConstraint: args.timeConstraint,
    currentApproach: args.currentApproach,
    projectContext: args.projectContext,
    projectBackground: args.projectBackground,
    sessionId: args.sessionId,
    provider: args.provider,
  };
}

const SESSION_MANAGEMENT_TOOL: Tool = {
  name: "session_management",
  description:
    "Manage thinking validation sessions for context persistence and progress tracking",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "get", "update", "list", "delete"],
        description: "Session action to perform",
      },
      sessionId: {
        type: "string",
        description: "Session ID (required for get, update, delete)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Tags to categorize the session",
      },
      title: {
        type: "string",
        description: "Session title/description (for create/update)",
      },
    },
    required: ["action"],
  },
};

// VALIDATE_CONFIGURATION_TOOL removed - functionality consolidated into validate_configuration_comprehensive

// COMPREHENSIVE_VALIDATION_TOOL removed - functionality consolidated into health_check tool

async function main() {
  console.error("Initializing Athena Protocol MCP Server...");

  // Load and validate configuration
  console.error("Loading configuration...");
  const config = loadConfig();
  console.error("Loaded config with providers:", config.providers.map(p => p.name));

  // Validate configuration
  console.error("Validating configuration...");
  const validationResult = validateConfiguration();
  printValidationResults(validationResult);

  if (!validationResult.valid) {
    console.error(
      "Configuration validation failed. Please fix the issues above."
    );
    if (detectMCPServerMode()) {
      console.error(
        "Tip: Check your MCP client configuration (mcp.json) and ensure all required environment variables are set in the 'env' field."
      );
      console.error(
        "Example MCP configuration: https://github.com/n0zer0d4y/athena-protocol#usage"
      );
    } else {
      console.error(
        "Tip: Check your .env file and ensure all required environment variables are set."
      );
    }
    process.exit(1);
  }

  console.error("Configuration validation passed. Starting server...");

  // Load and validate tool calling configuration
  console.error("Loading tool calling configuration...");
  const toolCallingConfig = loadToolCallingConfig();
  const toolValidation = validateToolCallingConfig(toolCallingConfig);

  if (!toolValidation.valid) {
    console.error("Tool calling configuration validation failed:");
    toolValidation.errors.forEach((error) => console.error(`  - ${error}`));
    console.error(
      "Tip: Check your tool calling environment variables in .env file."
    );
    process.exit(1);
  }

  // Display tool configuration status
  console.error("Tool Calling Configuration:");
  console.error(
    `  Read File: ${
      toolCallingConfig.readFile.enabled ? "ENABLED" : "DISABLED"
    }`
  );
  console.error(
    `  Grep: ${toolCallingConfig.grep.enabled ? "ENABLED" : "DISABLED"}`
  );
  console.error(
    `  List Files: ${
      toolCallingConfig.listFiles.enabled ? "ENABLED" : "DISABLED"
    }`
  );
  console.error(
    `  Write File: ${
      toolCallingConfig.writeToFile.enabled ? "ENABLED (HIGH RISK)" : "DISABLED"
    }`
  );
  console.error(
    `  Replace In File: ${
      toolCallingConfig.replaceInFile.enabled
        ? "ENABLED (HIGH RISK)"
        : "DISABLED"
    }`
  );
  console.error(
    `  Execute Command: ${
      toolCallingConfig.executeCommand.enabled
        ? "ENABLED (CRITICAL RISK)"
        : "DISABLED"
    }`
  );

  // Initialize the thinking validator
  const thinkingValidator = new ThinkingValidator();
  await thinkingValidator.initialize(config);

  // Initialize tool calling service and connect to thinking validator
  const toolCallingService = new ToolCallingService(toolCallingConfig);
  thinkingValidator.setToolCallingService(toolCallingService);

  // Create MCP server
  const server = new Server(
    {
      name: "athena-protocol",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register initialize handler (required for MCP protocol)
  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    const { protocolVersion, capabilities, clientInfo } = request.params || {};
    return {
      protocolVersion: protocolVersion || "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "athena-protocol",
        version: "0.1.0",
      },
    };
  });

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        THINKING_VALIDATION_TOOL,
        IMPACT_ANALYSIS_TOOL,
        ASSUMPTION_CHECKER_TOOL,
        DEPENDENCY_MAPPER_TOOL,
        THINKING_OPTIMIZER_TOOL,
        HEALTH_CHECK_TOOL, // Using the consolidated health check tool
        SESSION_MANAGEMENT_TOOL,
      ],
    };
  });

  // Register tool handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "thinking_validation": {
          try {
            const validatedParams = validateThinkingValidationParams(args);

            // Use enhanced validation with tool calling (now always required)
            const request = {
              thinking: validatedParams.thinking,
              proposedChange: validatedParams.proposedChange,
              context: validatedParams.context,
              urgency: validatedParams.urgency as "low" | "medium" | "high",
              projectContext: validatedParams.projectContext,
              projectBackground: validatedParams.projectBackground,
            };

            const validationResponse =
              await thinkingValidator.validateThinkingWithTools(
                request,
                validatedParams.sessionId,
                validatedParams.provider
              );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(validationResponse, null, 2),
                },
              ],
            };
          } catch (error) {
            if (error instanceof ToolParameterError) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: error.message }, null, 2),
                  },
                ],
              };
            }
            throw error;
          }
        }

        case "impact_analysis": {
          try {
            const validatedParams = validateImpactAnalysisParams(args);

            const impactResponse = await thinkingValidator.analyzeImpact(
              {
                change: validatedParams.change,
                systemContext: validatedParams.systemContext,
                projectContext: validatedParams.projectContext,
                projectBackground: validatedParams.projectBackground,
              },
              validatedParams.sessionId,
              validatedParams.provider
            );
            return {
              content: [
                { type: "text", text: JSON.stringify(impactResponse, null, 2) },
              ],
            };
          } catch (error) {
            if (error instanceof ToolParameterError) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: error.message }, null, 2),
                  },
                ],
              };
            }
            throw error;
          }
        }

        case "assumption_checker": {
          try {
            const validatedParams = validateAssumptionCheckerParams(args);

            const assumptionResponse = await thinkingValidator.checkAssumptions(
              {
                assumptions: validatedParams.assumptions,
                context: validatedParams.context,
                projectContext: validatedParams.projectContext,
                projectBackground: validatedParams.projectBackground,
              },
              validatedParams.sessionId,
              validatedParams.provider
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(assumptionResponse, null, 2),
                },
              ],
            };
          } catch (error) {
            if (error instanceof ToolParameterError) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: error.message }, null, 2),
                  },
                ],
              };
            }
            throw error;
          }
        }

        case "dependency_mapper": {
          try {
            const validatedParams = validateDependencyMapperParams(args);

            const dependencyResponse = await thinkingValidator.mapDependencies(
              {
                change: validatedParams.change,
                projectContext: validatedParams.projectContext,
                projectBackground: validatedParams.projectBackground,
              },
              validatedParams.sessionId,
              validatedParams.provider
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(dependencyResponse, null, 2),
                },
              ],
            };
          } catch (error) {
            if (error instanceof ToolParameterError) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: error.message }, null, 2),
                  },
                ],
              };
            }
            throw error;
          }
        }

        case "thinking_optimizer": {
          try {
            const validatedParams = validateThinkingOptimizerParams(args);

            const optimizationResponse =
              await thinkingValidator.optimizeThinking(
                {
                  problemType: validatedParams.problemType as
                    | "bug_fix"
                    | "feature_impl"
                    | "refactor",
                  complexity: validatedParams.complexity as
                    | "simple"
                    | "moderate"
                    | "complex",
                  timeConstraint: validatedParams.timeConstraint as
                    | "tight"
                    | "moderate"
                    | "flexible",
                  currentApproach: validatedParams.currentApproach,
                  projectContext: validatedParams.projectContext,
                  projectBackground: validatedParams.projectBackground,
                },
                validatedParams.sessionId,
                validatedParams.provider
              );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(optimizationResponse, null, 2),
                },
              ],
            };
          } catch (error) {
            if (error instanceof ToolParameterError) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: error.message }, null, 2),
                  },
                ],
              };
            }
            throw error;
          }
        }

        case "athena_health_check": {
          // Use consolidated health check tool
          const result = await HEALTH_CHECK_TOOL.execute(args);
          return {
            content: [
              {
                type: "text",
                text: result,
              },
            ],
          };
        }

        // list_providers tool removed - functionality consolidated into health_check

        case "session_management": {
          // Handle session management
          const sessionResult = await handleSessionManagement(
            thinkingValidator,
            args
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(sessionResult, null, 2) },
            ],
          };
        }

        // validate_configuration tool removed - use validate_configuration_comprehensive for detailed validation

        // validate_configuration_comprehensive tool removed - functionality consolidated into health_check

        default: {
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
          };
        }
      }
    } catch (error) {
      // Suppress detailed error logging to prevent stdout contamination
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool ${name}: ${(error as Error).message}`,
          },
        ],
      };
    }
  });

  // Listen on stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Signal that the server is ready
  console.error("Athena Protocol - Ready!");
}

async function handleSessionManagement(
  thinkingValidator: ThinkingValidator,
  args: any
) {
  const { action, sessionId, tags, title } = args;

  switch (action) {
    case "create": {
      // Sessions are created automatically, but we can create one with specific context
      return {
        success: true,
        message:
          "Session management is handled automatically. Use tools with a sessionId parameter to create sessions.",
      };
    }

    case "get": {
      if (!sessionId) {
        throw new Error("sessionId is required for get action");
      }
      const session = await thinkingValidator.getSession(sessionId);
      return session || { error: "Session not found" };
    }

    case "list": {
      const sessions = await thinkingValidator.listSessions();
      return sessions;
    }

    case "delete": {
      // We don't actually delete sessions in this implementation
      return { success: true, message: "Session deletion not implemented" };
    }

    case "update": {
      // Update session with new information
      if (!sessionId) {
        throw new Error("sessionId is required for update action");
      }
      return {
        success: true,
        message: "Session update not fully implemented but session exists",
        sessionId,
      };
    }

    default: {
      throw new Error(`Unsupported session action: ${action}`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error in Athena Protocol:", error);
  process.exit(1);
});
