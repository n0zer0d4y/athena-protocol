#!/usr/bin/env node

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

// Simple, predictable .env loading - FAIL FAST on configuration issues
function loadEnvironmentVariables() {
  // Primary: Project root (most reliable for MCP usage)
  const envPath = join(projectRoot, ".env");

  if (!existsSync(envPath)) {
    throw new Error(
      `Required .env file not found at: ${envPath}\n` +
        `Current working directory: ${process.cwd()}\n` +
        `Project root: ${projectRoot}\n` +
        `Please ensure .env file exists in the project root directory.`
    );
  }

  console.error(`📄 Loading .env from: ${envPath}`);
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    throw new Error(`Failed to parse .env file: ${result.error.message}`);
  }

  console.error(
    `✅ Successfully loaded .env with ${
      Object.keys(result.parsed || {}).length
    } variables`
  );
  return result.parsed || {};
}

// Load environment variables - fail fast if not found
const envVars = loadEnvironmentVariables();
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
  description: `Validate the primary agent's thinking process with focused, essential information.

Provider Override: Specify which LLM provider to use for this validation. Only providers with valid API keys will be accepted. ${getDefaultProviderDescription()}

Streamlined Inputs:
{
  "thinking": "Brief explanation of the approach and reasoning",
  "proposedChange": {
    "description": "What will be changed",
    "code": "The actual code change (before/after or new code)",
    "files": ["file1.js", "file2.js"]
  },
  "context": {
    "problem": "Brief problem description",
    "techStack": "react|node|python etc",
    "constraints": ["Key constraints like performance, backward compatibility"]
  },
  "urgency": "low|medium|high",
  "projectContext": {
    "projectRoot": "/absolute/path/to/project",
    "filesToAnalyze": ["src/main.ts", "package.json"],
    "workingDirectory": "/current/working/directory"
  },
  "projectBackground": "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination"
}

Focused Outputs:
{
  "validation": {
    "confidence": 85,
    "goAhead": true,
    "criticalIssues": [
      {
        "issue": "Specific problem identified",
        "suggestion": "Concrete fix suggestion",
        "priority": "high|medium|low"
      }
    ],
    "recommendations": [
      "1-3 specific, actionable recommendations"
    ],
    "testCases": [
      "Key test cases that should be added"
    ]
  }
}`,
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
              "Array of absolute file paths to analyze (must be full paths, not relative)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
        },
        required: ["projectRoot", "filesToAnalyze"],
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
  description: `Quickly identify key impacts of proposed changes.

Provider Override: Specify which LLM provider to use for this analysis. Only providers with valid API keys will be accepted. ${getDefaultProviderDescription()}

Streamlined Inputs:
{
  "change": {
    "description": "What is being changed",
    "code": "The code change",
    "files": ["affected files"]
  },
  "systemContext": {
    "architecture": "Brief architecture description",
    "keyDependencies": ["Service1", "Component2", "API3"]
  },
  "projectContext": {
    "projectRoot": "/absolute/path/to/project",
    "filesToAnalyze": ["src/main.ts", "package.json"],
    "workingDirectory": "/current/working/directory"
  },
  "projectBackground": "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination"
}

Focused Outputs:
{
  "impacts": {
    "overallRisk": "low|medium|high",
    "affectedAreas": [
      {
        "area": "UserProfile component",
        "impact": "Potential null reference errors",
        "mitigation": "Add null checks"
      }
    ],
    "cascadingRisks": [
      {
        "risk": "Service X may be affected",
        "probability": "low|medium|high",
        "action": "Test integration with Service X"
      }
    ],
    "quickTests": [
      "Essential tests to run before deployment"
    ]
  }
}`,
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
              "Array of absolute file paths to analyze (must be full paths, not relative)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
        },
        required: ["projectRoot", "filesToAnalyze"],
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
  description: `Rapidly validate key assumptions without over-analysis.

Provider Override: Specify which LLM provider to use for this validation. Only providers with valid API keys will be accepted. ${getDefaultProviderDescription()}

Streamlined Inputs:
{
  "assumptions": [
    "User object is always available",
    "API response time < 200ms",
    "Database connection is stable"
  ],
  "context": {
    "component": "UserProfile",
    "environment": "production"
  },
  "projectContext": {
    "projectRoot": "/absolute/path/to/project",
    "filesToAnalyze": ["src/main.ts", "package.json"],
    "workingDirectory": "/current/working/directory"
  },
  "projectBackground": "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination"
}

Focused Outputs:
{
  "validation": {
    "validAssumptions": ["User object is always available"],
    "riskyAssumptions": [
      {
        "assumption": "API response time < 200ms",
        "risk": "High traffic scenarios may exceed this",
        "mitigation": "Add timeout handling"
      }
    ],
    "quickVerifications": [
      "Simple checks to validate assumptions"
    ]
  }
}`,
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
              "Array of absolute file paths to analyze (must be full paths, not relative)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
        },
        required: ["projectRoot", "filesToAnalyze"],
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
  description: `Identify critical dependencies efficiently.

Provider Override: Specify which LLM provider to use for this analysis. Only providers with valid API keys will be accepted. ${getDefaultProviderDescription()}

Streamlined Inputs:
{
  "change": {
    "description": "Brief change description",
    "files": ["files being modified"],
    "components": ["components being changed"]
  },
  "projectContext": {
    "projectRoot": "/absolute/path/to/project",
    "filesToAnalyze": ["src/main.ts", "package.json"],
    "workingDirectory": "/current/working/directory"
  },
  "projectBackground": "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination"
}

Focused Outputs:
{
  "dependencies": {
    "critical": [
      {
        "dependency": "UserService.getUser",
        "impact": "Breaking change will crash UserProfile",
        "action": "Update UserService tests"
      }
    ],
    "secondary": [
      {
        "dependency": "Analytics service",
        "impact": "May lose tracking data",
        "action": "Add error handling"
      }
    ],
    "testFocus": [
      "Key integration tests to run"
    ]
  }
}`,
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
              "Array of absolute file paths to analyze (must be full paths, not relative)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
        },
        required: ["projectRoot", "filesToAnalyze"],
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
  description: `Optimize thinking approach based on problem type.

Provider Override: Specify which LLM provider to use for this optimization. Only providers with valid API keys will be accepted. ${getDefaultProviderDescription()}

Streamlined Inputs:
{
  "problemType": "bug_fix|feature_impl|refactor",
  "complexity": "simple|moderate|complex",
  "timeConstraint": "tight|moderate|flexible",
  "currentApproach": "Brief description of current thinking",
  "projectContext": {
    "projectRoot": "/absolute/path/to/project",
    "filesToAnalyze": ["src/main.ts", "package.json"],
    "workingDirectory": "/current/working/directory"
  },
  "projectBackground": "Brief description of the project, its purpose, technology stack, and key components to prevent hallucination"
}

Focused Outputs:
{
  "optimizedStrategy": {
    "approach": "Recommended approach type",
    "toolsToUse": ["thinking_validation", "impact_analysis"],
    "timeAllocation": {
      "thinking": "30%",
      "implementation": "60%",
      "testing": "10%"
    },
    "successProbability": 85,
    "keyFocus": "What to focus on most"
  }
}`,
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
              "Array of absolute file paths to analyze (must be full paths, not relative)",
          },
          workingDirectory: {
            type: "string",
            description: "Current working directory (optional)",
          },
        },
        required: ["projectRoot", "filesToAnalyze"],
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
  if (
    !args.projectContext.filesToAnalyze ||
    !Array.isArray(args.projectContext.filesToAnalyze)
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.filesToAnalyze' must be an array"
    );
  }

  // Validate that all files in the array are valid strings
  for (const file of args.projectContext.filesToAnalyze) {
    if (typeof file !== "string" || file.trim().length === 0) {
      throw new ToolParameterError(
        "Invalid filesToAnalyze entry: all entries must be non-empty strings representing file paths"
      );
    }
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
  if (
    !args.projectContext.filesToAnalyze ||
    !Array.isArray(args.projectContext.filesToAnalyze)
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.filesToAnalyze' must be an array"
    );
  }

  // Validate that all files in the array are valid strings
  for (const file of args.projectContext.filesToAnalyze) {
    if (typeof file !== "string" || file.trim().length === 0) {
      throw new ToolParameterError(
        "Invalid filesToAnalyze entry: all entries must be non-empty strings representing file paths"
      );
    }
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
  if (
    !args.projectContext.filesToAnalyze ||
    !Array.isArray(args.projectContext.filesToAnalyze)
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.filesToAnalyze' must be an array"
    );
  }

  // Validate that all files in the array are valid strings
  for (const file of args.projectContext.filesToAnalyze) {
    if (typeof file !== "string" || file.trim().length === 0) {
      throw new ToolParameterError(
        "Invalid filesToAnalyze entry: all entries must be non-empty strings representing file paths"
      );
    }
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
  if (
    !args.projectContext.filesToAnalyze ||
    !Array.isArray(args.projectContext.filesToAnalyze)
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.filesToAnalyze' must be an array"
    );
  }

  // Validate that all files in the array are valid strings
  for (const file of args.projectContext.filesToAnalyze) {
    if (typeof file !== "string" || file.trim().length === 0) {
      throw new ToolParameterError(
        "Invalid filesToAnalyze entry: all entries must be non-empty strings representing file paths"
      );
    }
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
  if (
    !args.projectContext.filesToAnalyze ||
    !Array.isArray(args.projectContext.filesToAnalyze)
  ) {
    throw new ToolParameterError(
      "Missing or invalid required parameter: 'projectContext.filesToAnalyze' must be an array"
    );
  }

  // Validate that all files in the array are valid strings
  for (const file of args.projectContext.filesToAnalyze) {
    if (typeof file !== "string" || file.trim().length === 0) {
      throw new ToolParameterError(
        "Invalid filesToAnalyze entry: all entries must be non-empty strings representing file paths"
      );
    }
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
  const config = loadConfig();
  console.error("Loaded config:", JSON.stringify(config, null, 2));

  // Validate configuration
  console.log("🔍 Validating configuration...");
  const validationResult = validateConfiguration();
  printValidationResults(validationResult);

  if (!validationResult.valid) {
    console.error(
      "❌ Configuration validation failed. Please fix the issues above."
    );
    console.error(
      "💡 Tip: Check your .env file and ensure all required environment variables are set."
    );
    process.exit(1);
  }

  console.log("✅ Configuration validation passed. Starting server...");

  // Load and validate tool calling configuration
  console.log("🔧 Loading tool calling configuration...");
  const toolCallingConfig = loadToolCallingConfig();
  const toolValidation = validateToolCallingConfig(toolCallingConfig);

  if (!toolValidation.valid) {
    console.error("❌ Tool calling configuration validation failed:");
    toolValidation.errors.forEach((error) => console.error(`  - ${error}`));
    console.error(
      "💡 Tip: Check your tool calling environment variables in .env file."
    );
    process.exit(1);
  }

  // Display tool configuration status
  console.log("🔧 Tool Calling Configuration:");
  console.log(
    `  Read File: ${toolCallingConfig.readFile.enabled ? "✅" : "❌"}`
  );
  console.log(`  Grep: ${toolCallingConfig.grep.enabled ? "✅" : "❌"}`);
  console.log(
    `  List Files: ${toolCallingConfig.listFiles.enabled ? "✅" : "❌"}`
  );
  console.log(
    `  Write File: ${
      toolCallingConfig.writeToFile.enabled ? "❌ HIGH RISK" : "✅ DISABLED"
    }`
  );
  console.log(
    `  Replace In File: ${
      toolCallingConfig.replaceInFile.enabled ? "❌ HIGH RISK" : "✅ DISABLED"
    }`
  );
  console.log(
    `  Execute Command: ${
      toolCallingConfig.executeCommand.enabled
        ? "❌ CRITICAL RISK"
        : "✅ DISABLED"
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
      console.error(`Error executing tool ${name}:`, error);
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
