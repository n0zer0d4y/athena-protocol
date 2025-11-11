# Athena Protocol MCP Server

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![MCP Dev](https://badge.mcpx.dev?type=dev "MCP Dev")
![MCP Server](https://badge.mcpx.dev?type=server "MCP Server")
![MCP server with features'](https://badge.mcpx.dev?type=server&features=tools "MCP server with features")
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

An intelligent MCP server that acts as an AI tech lead for coding agents—providing expert validation, impact analysis, and strategic guidance before code changes are made. Like a senior engineer reviewing your approach, Athena Protocol helps AI agents catch critical issues early, validate assumptions against the actual codebase, and optimize their problem-solving strategies. The result: higher quality code, fewer regressions, and more thoughtful architectural decisions.

**Key Feature:** Precision file analysis with `analysisTargets` - achieve 70-85% token reduction and 3-4× faster performance with precision-targeted code analysis. See [Enhanced File Analysis](#enhanced-file-analysis-new) for details.

## Table of Contents

- [Security](#security)
- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Contributing](#contributing)
- [License](#license)

## Security

This server handles API keys for multiple LLM providers. Ensure your `.env` file is properly secured and never committed to version control. The server validates all API keys on startup and provides detailed error messages for configuration issues.

## Background

The Athena Protocol MCP Server provides systematic thinking validation for AI coding agents. It supports 14 LLM providers and offers various validation tools including thinking validation, impact analysis, assumption checking, dependency mapping, and thinking optimization.

Key features:

- **Smart Client Mode** with precision-targeted code analysis (70-85% token reduction)
- Environment-driven configuration with no hardcoded defaults
- Multi-provider LLM support (14 providers) with automatic fallback
- Enhanced file reading with multiple modes (full, head, tail, range)
- Concurrent file operations for 3-4× performance improvement
- Session-based validation history and memory management
- Comprehensive configuration validation and health monitoring
- Dual-agent architecture for efficient validation workflows

## Install

This module depends upon a knowledge of Node.js and npm.

```bash
npm install
npm run build
```

### Prerequisites

- Node.js >= 18
- npm or yarn

### Configuration

The Athena Protocol uses 100% environment-driven configuration - no hardcoded provider values or defaults. Configure everything through your `.env` file:

```bash
# 1. Get your API key from any supported provider
# 2. Create .env file with REQUIRED configuration:
echo "DEFAULT_LLM_PROVIDER=openai" > .env
echo "PROVIDER_SELECTION_PRIORITY=openai,anthropic,google" >> .env
echo "OPENAI_API_KEY=sk-your-openai-api-key-here" >> .env
echo "OPENAI_MODEL=gpt-4-turbo" >> .env
echo "OPENAI_TEMPERATURE=0.7" >> .env
echo "OPENAI_MAX_TOKENS=4000" >> .env

# 3. Install and test
npm install
npm run build
npm run validate-config  # This will validate your configuration
npm test
```

#### Critical Configuration Requirements

- `PROVIDER_SELECTION_PRIORITY` is REQUIRED - list your providers in priority order
- No hardcoded fallbacks exist - all configuration must be explicit in `.env`
- Fail-fast validation - invalid configuration causes immediate startup failure
- Complete provider config required - API key, model, and parameters for each provider

#### Supported Providers

The Athena Protocol supports 14 LLM providers. While OpenAI is commonly used, you can configure any of:

**Major Cloud Providers:**

- OpenAI - GPT-4, GPT-4-turbo, GPT-3.5-turbo
- Anthropic - Claude 3 Sonnet/Opus/Haiku
- Google - Gemini Pro/Pro Vision
- Azure OpenAI - Enterprise-grade GPT models
- AWS Bedrock - Claude, Llama, and more
- Google Vertex AI - Gemini with enterprise features

**Specialized Providers:**

- OpenRouter - Access to 200+ models
- Groq - Ultra-fast inference
- Mistral AI - Open-source models
- Perplexity - Search-augmented models
- XAI - Grok models
- Qwen - Alibaba's high-performance LLMs

**Local/Self-Hosted:**

- Ollama - Run models locally
- ZAI - Custom deployments

Quick switch example:

```bash
# Edit .env file
ANTHROPIC_API_KEY=sk-ant-your-key-here
DEFAULT_LLM_PROVIDER=anthropic

# Restart server
npm run build && npm start
```

#### Provider Switching

See the [detailed provider guide](./PROVIDER_GUIDE.md) for complete setup instructions.

## Usage

### Server Modes

#### MCP Server Mode (for production use)

```bash
npm start                    # Start MCP server for client integration
npm run dev                  # Development mode with auto-restart
```

#### Standalone Mode (for testing)

```bash
npm run start:standalone     # Test server without MCP client
npm run dev:standalone       # Development standalone mode
```

### Configuration Tools

```bash
# Validate your complete configuration
npm run validate-config

# Or use the comprehensive MCP validation tool
node dist/index.js
# Then call: validate_configuration_comprehensive
```

### Key Features

#### Multi-Provider LLM Support

Athena Protocol supports 14 providers including:

- **Cloud Providers**: OpenAI, Anthropic, Google, Azure OpenAI, AWS Bedrock, Vertex AI
- **Specialized**: OpenRouter (200+ models), Groq, Mistral, Perplexity, XAI, Qwen
- **Local/Self-Hosted**: Ollama, ZAI

All providers require API keys (except Ollama for local models). See configuration section for setup.

#### Intelligent Thinking Validation

- Focused Validation: Validates essential aspects of reasoning with streamlined communication
- Dual-Agent Architecture: Primary agent and validation agent work in partnership
- Confidence Scoring: Explicit confidence levels to guide decision-making
- Loop Prevention: Maximum 3 exchanges per task to prevent analysis paralysis

#### Systematic Approach

- Essential Information Only: Share what's necessary for effective validation
- Actionable Outputs: Clear, specific recommendations that can be immediately applied
- Progressive Refinement: Start broad, get specific only when needed
- Session Management: Maintains persistent validation sessions across multiple attempts

#### Dual Mode Operation

- MCP Server Mode: Full integration with MCP clients (Claude Desktop, Cline, etc.)
- Standalone Mode: Independent testing and verification without MCP client

## API

The Athena Protocol MCP Server provides the following tools for thinking validation and analysis:

### thinking_validation

Validate the primary agent's thinking process with focused, essential information.

**Required Parameters:**

- `thinking` (string): Brief explanation of the approach and reasoning
- `proposedChange` (object): Details of the proposed change
  - `description` (string, required): What will be changed
  - `code` (string, optional): The actual code change
  - `files` (array, optional): Files that will be affected
- `context` (object): Context for the validation
  - `problem` (string, required): Brief problem description
  - `techStack` (string, required): Technology stack (react|node|python etc)
  - `constraints` (array, optional): Key constraints
- `urgency` (string): Urgency level (`low`, `medium`, or `high`)
- `projectContext` (object): Project context for file analysis
  - `projectRoot` (string, required): Absolute path to project root
  - `workingDirectory` (string, optional): Current working directory
  - `analysisTargets` (array, **REQUIRED**): Specific code sections with targeted reading
    - `file` (string, required): File path (relative or absolute)
    - `mode` (string, optional): Read mode - `full`, `head`, `tail`, or `range`
    - `lines` (number, optional): Number of lines (for head/tail modes)
    - `startLine` (number, optional): Start line number (for range mode, 1-indexed)
    - `endLine` (number, optional): End line number (for range mode, 1-indexed)
    - `priority` (string, optional): Analysis priority - `critical`, `important`, or `supplementary`
- `projectBackground` (string): Brief project description to prevent hallucination

**Optional Parameters:**

- `sessionId` (string): Session ID for context persistence
- `provider` (string): LLM provider override (openai, anthropic, google, etc.)

**Output:**

Returns validation results with confidence score, critical issues, recommendations, and test cases.

### impact_analysis

Quickly identify key impacts of proposed changes.

**Required Parameters:**

- `change` (object): Details of the change
  - `description` (string, required): What is being changed
  - `code` (string, optional): The code change
  - `files` (array, optional): Affected files
- `projectContext` (object): Project context (same structure as thinking_validation)
  - `projectRoot` (string, required)
  - `analysisTargets` (array, **REQUIRED**): Files to analyze with read modes
  - `workingDirectory` (optional)
- `projectBackground` (string): Brief project description

**Optional Parameters:**

- `systemContext` (object): System architecture context
  - `architecture` (string): Brief architecture description
  - `keyDependencies` (array): Key system dependencies
- `sessionId` (string): Session ID for context persistence
- `provider` (string): LLM provider override

**Output:**

Returns overall risk assessment, affected areas, cascading risks, and quick tests to run.

### assumption_checker

Rapidly validate key assumptions without over-analysis.

**Required Parameters:**

- `assumptions` (array): List of assumption strings to validate
- `context` (object): Validation context
  - `component` (string, required): Component name
  - `environment` (string, required): Environment (production, development, staging, testing)
- `projectContext` (object): Project context (same structure as thinking_validation)
  - `projectRoot` (string, required)
  - `analysisTargets` (array, **REQUIRED**): Files to analyze with read modes
- `projectBackground` (string): Brief project description

**Optional Parameters:**

- `sessionId` (string): Session ID for context persistence
- `provider` (string): LLM provider override

**Output:**

Returns valid assumptions, risky assumptions with mitigations, and quick verification steps.

### dependency_mapper

Identify critical dependencies efficiently.

**Required Parameters:**

- `change` (object): Details of the change
  - `description` (string, required): Brief change description
  - `files` (array, optional): Files being modified
  - `components` (array, optional): Components being changed
- `projectContext` (object): Project context (same structure as thinking_validation)
  - `projectRoot` (string, required)
  - `analysisTargets` (array, **REQUIRED**): Files to analyze with read modes
- `projectBackground` (string): Brief project description

**Optional Parameters:**

- `sessionId` (string): Session ID for context persistence
- `provider` (string): LLM provider override

**Output:**

Returns critical and secondary dependencies, with impact analysis and test focus areas.

### thinking_optimizer

Optimize thinking approach based on problem type.

**Required Parameters:**

- `problemType` (string): Type of problem (`bug_fix`, `feature_impl`, or `refactor`)
- `complexity` (string): Complexity level (`simple`, `moderate`, or `complex`)
- `timeConstraint` (string): Time constraint (`tight`, `moderate`, or `flexible`)
- `currentApproach` (string): Brief description of current thinking
- `projectContext` (object): Project context (same structure as thinking_validation)
  - `projectRoot` (string, required)
  - `analysisTargets` (array, **REQUIRED**): Files to analyze with read modes
- `projectBackground` (string): Brief project description

**Optional Parameters:**

- `sessionId` (string): Session ID for context persistence
- `provider` (string): LLM provider override

**Output:**

Returns optimized strategy, recommended tools, time allocation, success probability, and key focus areas.

### athena_health_check

Check the health status and configuration of the Athena Protocol server.

**Parameters:** None

**Output:**

Returns default provider, list of active providers with valid API keys, configuration status, and system health information.

### session_management

Manage thinking validation sessions for context persistence and progress tracking.

**Required Parameters:**

- `action` (string): Session action - `create`, `get`, `update`, `list`, or `delete`

**Optional Parameters:**

- `sessionId` (string): Session ID (required for get, update, delete actions)
- `tags` (array): Tags to categorize the session
- `title` (string): Session title/description (for create/update)

**Output:**

Returns session information or list of sessions depending on the action.

---

### Enhanced File Analysis (NEW)

All tools now support **Smart Client Mode** with `analysisTargets` for precision targeting:

**Benefits:**

- **70-85% token reduction** by reading only relevant code sections
- **3-4× faster** with concurrent file reading
- **Mode-based reading**: full, head (first N lines), tail (last N lines), range (lines X-Y)
- **Priority processing**: critical → important → supplementary

**Example:**

```json
{
  "projectContext": {
    "projectRoot": "/path/to/project",
    "analysisTargets": [
      {
        "file": "src/auth.ts",
        "mode": "range",
        "startLine": 45,
        "endLine": 78,
        "priority": "critical"
      },
      {
        "file": "src/config.ts",
        "mode": "head",
        "lines": 20,
        "priority": "supplementary"
      }
    ]
  }
}
```

**Note:** All tools require `analysisTargets` for file analysis. Provide at least one file with appropriate read mode (`full`, `head`, `tail`, or `range`).

## Contributing

This server is designed specifically for LLM coding agents. Contributions should focus on:

- Adding new LLM providers
- Improving validation effectiveness
- Enhancing context awareness
- Expanding validation coverage
- Optimizing memory management
- Adding new validation strategies

## License

MIT License - see LICENSE file for details.
