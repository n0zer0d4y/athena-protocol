# Athena Protocol MCP Server

[![license](https://img.shields.io/github/license/:user/:repo.svg)](LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

A comprehensive, intelligent MCP server designed to provide systematic thinking validation for LLM coding agents. This server enables AI agents to achieve higher accuracy through focused validation of reasoning processes before action, with streamlined communication to prevent endless loops and information overload.

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

The Athena Protocol MCP Server provides systematic thinking validation for AI coding agents. It supports multiple LLM providers (OpenAI, Anthropic, Google, OpenRouter, Qwen) and offers various validation tools including thinking validation, impact analysis, assumption checking, dependency mapping, and thinking optimization.

Key features:

- Environment-driven configuration with no hardcoded defaults
- Multi-provider LLM support with automatic fallback
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

While OpenAI (GPT-4) is the primary provider, you can configure additional providers:

- Anthropic Claude - Excellent for complex analysis
- Google Gemini - Fast and cost-effective
- OpenRouter - Access to multiple models
- Qwen - Alibaba's high-performance LLM

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

- OpenAI (Default): GPT-4, GPT-3.5-turbo, GPT-4-turbo (requires API key)
- Anthropic: Claude 3 Sonnet/Opus/Haiku (requires API key)
- Google: Gemini Pro/Pro Vision (requires API key)
- OpenRouter: Access to 200+ models (requires API key)
- Qwen: Qwen-turbo/plus/max (requires API key)

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

**Parameters:**

- `thinking`: Brief explanation of the approach and reasoning
- `proposedChange`: Details of the proposed change
- `context`: Context for the validation
- `urgency`: Urgency level
- `sessionId`: Optional session ID for context persistence
- `provider`: Optional LLM provider to use

### impact_analysis

Quickly identify key impacts of proposed changes.

**Parameters:**

- `change`: Details of the change
- `systemContext`: System context for impact analysis
- `sessionId`: Optional session ID for context persistence
- `provider`: Optional LLM provider to use

### assumption_checker

Rapidly validate key assumptions without over-analysis.

**Parameters:**

- `assumptions`: List of assumptions to validate
- `context`: Context for assumption validation
- `sessionId`: Optional session ID for context persistence
- `provider`: Optional LLM provider to use

### dependency_mapper

Identify critical dependencies efficiently.

**Parameters:**

- `change`: Details of the change
- `sessionId`: Optional session ID for context persistence
- `provider`: Optional LLM provider to use

### thinking_optimizer

Optimize thinking approach based on problem type.

**Parameters:**

- `problemType`: Type of problem being solved
- `complexity`: Complexity level
- `timeConstraint`: Time constraint
- `currentApproach`: Brief description of current thinking
- `sessionId`: Optional session ID for context persistence
- `provider`: Optional LLM provider to use

### athena_health_check

Check the health status of all available LLM providers.

### session_management

Manage thinking validation sessions for context persistence.

**Parameters:**

- `action`: Session action to perform (create, get, update, list, delete)
- `sessionId`: Session ID (required for get, update, delete)
- `tags`: Tags to categorize the session
- `title`: Session title/description

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
