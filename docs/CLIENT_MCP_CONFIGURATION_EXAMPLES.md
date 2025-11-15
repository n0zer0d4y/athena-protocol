# MCP Configuration Examples for Athena Protocol

This document provides working examples for configuring Athena Protocol in MCP clients using environment variables. **Only the configurations shown here are tested and guaranteed to work.**

## Table of Contents

- [Cursor Configuration](#cursor-configuration)
- [Claude Desktop Configuration](#claude-desktop-configuration)
- [GPT-5 OpenAI Setup](#gpt-5-openai-setup)
- [Google Gemini Setup](#google-gemini-setup)
- [Troubleshooting](#troubleshooting)

## Cursor Configuration

Add these examples to your `~/.cursor/mcp.json` file:

### GPT-5 OpenAI Setup

```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "openai",
        "OPENAI_API_KEY": "your-openai-api-key-here",
        "OPENAI_MODEL_DEFAULT": "gpt-5",
        "OPENAI_MAX_COMPLETION_TOKENS_DEFAULT": "8192",
        "OPENAI_VERBOSITY_DEFAULT": "medium",
        "OPENAI_REASONING_EFFORT_DEFAULT": "high",
        "LLM_TEMPERATURE_DEFAULT": "0.7",
        "LLM_MAX_TOKENS_DEFAULT": "2000",
        "LLM_TIMEOUT_DEFAULT": "30000"
      },
      "type": "stdio",
      "timeout": 300
    }
  }
}
```

### Google Gemini Setup

```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "google",
        "GOOGLE_API_KEY": "your-google-api-key-here",
        "GOOGLE_MODEL_DEFAULT": "gemini-2.5-flash",
        "LLM_TEMPERATURE_DEFAULT": "0.7",
        "LLM_MAX_TOKENS_DEFAULT": "2000",
        "LLM_TIMEOUT_DEFAULT": "30000"
      },
      "type": "stdio",
      "timeout": 300
    }
  }
}
```

## Claude Desktop Configuration

For Claude Desktop, use the same environment variables as Cursor:

### macOS Configuration

```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "openai",
        "OPENAI_API_KEY": "your-openai-api-key-here",
        "OPENAI_MODEL_DEFAULT": "gpt-5",
        "OPENAI_MAX_COMPLETION_TOKENS_DEFAULT": "8192",
        "OPENAI_VERBOSITY_DEFAULT": "medium",
        "OPENAI_REASONING_EFFORT_DEFAULT": "high",
        "LLM_TEMPERATURE_DEFAULT": "0.7",
        "LLM_MAX_TOKENS_DEFAULT": "2000",
        "LLM_TIMEOUT_DEFAULT": "30000"
      }
    }
  }
}
```

### Windows Configuration

```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx.cmd",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "google",
        "GOOGLE_API_KEY": "your-google-api-key-here",
        "GOOGLE_MODEL_DEFAULT": "gemini-2.5-flash",
        "LLM_TEMPERATURE_DEFAULT": "0.7",
        "LLM_MAX_TOKENS_DEFAULT": "2000",
        "LLM_TIMEOUT_DEFAULT": "30000"
      }
    }
  }
}
```

## GPT-5 OpenAI Setup

GPT-5 models have specific parameters that differ from standard models:

- `OPENAI_MODEL_DEFAULT`: Set to "gpt-5"
- `OPENAI_MAX_COMPLETION_TOKENS_DEFAULT`: Controls maximum completion tokens (GPT-5 specific)
- `OPENAI_VERBOSITY_DEFAULT`: Controls verbosity level (GPT-5 specific)
- `OPENAI_REASONING_EFFORT_DEFAULT`: Controls reasoning effort (GPT-5 specific)
- **Note**: The standard parameters `LLM_TEMPERATURE_DEFAULT`, `LLM_MAX_TOKENS_DEFAULT`, and `LLM_TIMEOUT_DEFAULT` are currently required for GPT-5 models but are not used by the model itself. This is a temporary limitation that will be addressed in a future refactoring (target: v0.3.0)

## Google Gemini Setup

Google Gemini uses standard LLM parameters:

- `GOOGLE_MODEL_DEFAULT`: Set to your preferred Gemini model (e.g., "gemini-2.5-flash")
- Standard parameters: `LLM_TEMPERATURE_DEFAULT`, `LLM_MAX_TOKENS_DEFAULT`, `LLM_TIMEOUT_DEFAULT`

## Future Improvements

### GPT-5 Configuration Simplification

**Current Limitation**: GPT-5 configurations currently require the standard LLM parameters (`LLM_TEMPERATURE_DEFAULT`, `LLM_MAX_TOKENS_DEFAULT`, `LLM_TIMEOUT_DEFAULT`) even though these are not used by GPT-5 models.

**Planned Changes**:

- GPT-5 configurations will only require the GPT-5 specific parameters
- Standard LLM parameters will become optional for GPT-5 models
- Configuration validation will be updated to reflect model-specific requirements

**Timeline**: Expected in v0.3.0 release

## Troubleshooting

### Common Issues

#### "Configuration validation failed"

- Ensure all environment variables from the working examples are included
- Check that API keys are valid and properly formatted
- Verify the `DEFAULT_LLM_PROVIDER` is set to either "openai" or "google"

#### "Temperature configuration missing for openai"

- This occurs when using GPT-5 models. Ensure `LLM_TEMPERATURE_DEFAULT` is included in your configuration
- Note: GPT-5 models do require this parameter in the current implementation

#### Timeout Issues

- Increase the `timeout` value in your MCP configuration (recommended: 300)
- Check your internet connection and API key validity

#### API Key Issues

- Ensure API keys are not placeholder values
- For OpenAI: Use keys starting with "sk-"
- For Google: Use valid Google AI API keys

### Environment Variable Priority

Athena Protocol uses this priority order:

1. **MCP client `env` field** (highest priority - for npx usage)
2. **Local `.env` file** (for local development)
3. **System environment variables** (lowest priority)

### Testing Configuration

To test your configuration:

1. Save your MCP configuration
2. Restart your MCP client (Cursor/Claude Desktop)
3. Use the `athena_health_check` tool to verify configuration
4. Check the server logs for any error messages

### Important Notes

- **Only the configurations shown in this document are tested and guaranteed to work**
- GPT-5 models require specific parameters (`OPENAI_MAX_COMPLETION_TOKENS_DEFAULT`, `OPENAI_VERBOSITY_DEFAULT`, `OPENAI_REASONING_EFFORT_DEFAULT`)
- Local `.env` file execution remains unchanged and fully functional
- For local development, see the main README for `.env` file setup
