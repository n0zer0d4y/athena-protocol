# MCP Configuration Examples for Athena Protocol

This document provides comprehensive examples for configuring Athena Protocol in various MCP clients using environment variables.

## Table of Contents

- [Cursor Configuration](#cursor-configuration)
- [Claude Desktop Configuration](#claude-desktop-configuration)
- [Basic Setup Examples](#basic-setup-examples)
- [Advanced Configuration](#advanced-configuration)
- [Multi-Provider Setup](#multi-provider-setup)
- [Troubleshooting](#troubleshooting)

## Cursor Configuration

Add these examples to your `~/.cursor/mcp.json` file:

### Basic OpenAI Setup
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "openai",
        "PROVIDER_SELECTION_PRIORITY": "openai",
        "OPENAI_API_KEY": "sk-your-openai-api-key-here"
      },
      "type": "stdio",
      "timeout": 300
    }
  }
}
```

### Anthropic Claude Setup
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "anthropic",
        "PROVIDER_SELECTION_PRIORITY": "anthropic",
        "ANTHROPIC_API_KEY": "sk-ant-your-anthropic-api-key-here"
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
        "PROVIDER_SELECTION_PRIORITY": "google",
        "GOOGLE_API_KEY": "your-google-api-key-here"
      },
      "type": "stdio",
      "timeout": 300
    }
  }
}
```

## Claude Desktop Configuration

For Claude Desktop, the configuration format is similar but may require different paths:

### macOS Configuration
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "anthropic",
        "PROVIDER_SELECTION_PRIORITY": "anthropic,openai",
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here",
        "OPENAI_API_KEY": "sk-your-openai-key-here"
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
        "DEFAULT_LLM_PROVIDER": "openai",
        "PROVIDER_SELECTION_PRIORITY": "openai",
        "OPENAI_API_KEY": "sk-your-openai-api-key-here"
      }
    }
  }
}
```

## Basic Setup Examples

### Single Provider - Cost Effective
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "google",
        "PROVIDER_SELECTION_PRIORITY": "google",
        "GOOGLE_API_KEY": "your-google-api-key-here",
        "GOOGLE_MODEL": "gemini-1.5-pro"
      },
      "type": "stdio",
      "timeout": 180
    }
  }
}
```

### Single Provider - High Performance
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "groq",
        "PROVIDER_SELECTION_PRIORITY": "groq",
        "GROQ_API_KEY": "your-groq-api-key-here",
        "GROQ_MODEL": "deepseek-r1-distill-llama-70b"
      },
      "type": "stdio",
      "timeout": 120
    }
  }
}
```

### Single Provider - Maximum Reasoning
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "anthropic",
        "PROVIDER_SELECTION_PRIORITY": "anthropic",
        "ANTHROPIC_API_KEY": "sk-ant-your-anthropic-api-key-here",
        "ANTHROPIC_MODEL": "claude-3-5-sonnet-20241022"
      },
      "type": "stdio",
      "timeout": 300
    }
  }
}
```

## Advanced Configuration

### GPT-5 with Advanced Parameters
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "openai",
        "PROVIDER_SELECTION_PRIORITY": "openai",
        "OPENAI_API_KEY": "sk-your-openai-api-key-here",
        "OPENAI_MODEL": "gpt-5",
        "OPENAI_MAX_COMPLETION_TOKENS": "8000",
        "OPENAI_VERBOSITY": "high",
        "OPENAI_REASONING_EFFORT": "high"
      },
      "type": "stdio",
      "timeout": 600
    }
  }
}
```

### Custom Performance Settings
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "openai",
        "PROVIDER_SELECTION_PRIORITY": "openai",
        "OPENAI_API_KEY": "sk-your-openai-api-key-here",
        "LLM_TEMPERATURE": "0.7",
        "LLM_MAX_TOKENS": "3000",
        "LLM_TIMEOUT": "45000"
      },
      "type": "stdio",
      "timeout": 300
    }
  }
}
```

## Multi-Provider Setup

### Enterprise Multi-Provider (Recommended)
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "anthropic",
        "PROVIDER_SELECTION_PRIORITY": "anthropic,openai,google,groq",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "OPENAI_API_KEY": "sk-...",
        "GOOGLE_API_KEY": "...",
        "GROQ_API_KEY": "...",
        "ANTHROPIC_MODEL": "claude-3-5-sonnet-20241022",
        "OPENAI_MODEL": "gpt-4o",
        "GOOGLE_MODEL": "gemini-1.5-pro",
        "GROQ_MODEL": "deepseek-r1-distill-llama-70b"
      },
      "type": "stdio",
      "timeout": 300
    }
  }
}
```

### Development Fallback Chain
```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "npx",
      "args": ["@n0zer0d4y/athena-protocol"],
      "env": {
        "DEFAULT_LLM_PROVIDER": "groq",
        "PROVIDER_SELECTION_PRIORITY": "groq,openai,google",
        "GROQ_API_KEY": "gsk-...",
        "OPENAI_API_KEY": "sk-...",
        "GOOGLE_API_KEY": "..."
      },
      "type": "stdio",
      "timeout": 180
    }
  }
}
```

## Troubleshooting

### Common Issues

#### "Configuration validation failed"
- Check that all required environment variables are set in your MCP config
- Ensure `DEFAULT_LLM_PROVIDER` matches one of the providers in `PROVIDER_SELECTION_PRIORITY`
- Verify API keys are valid and not placeholder values

#### "No providers configured"
- At least one API key must be provided
- The provider with the API key must be included in `PROVIDER_SELECTION_PRIORITY`

#### Timeout Issues
- Increase the `timeout` value in your MCP configuration
- For GPT-5 models, use timeout of 600 or higher
- Check your internet connection and provider service status

#### API Key Issues
- Ensure API keys are not placeholder values like "your-api-key-here"
- Check that API keys have proper permissions for the requested operations
- Verify API keys are not expired

### Environment Variable Priority

Athena Protocol uses this priority order:
1. **MCP client `env` field** (highest priority)
2. **Local `.env` file** (if running locally)
3. **System environment variables** (lowest priority)

MCP environment variables always take precedence over `.env` files.

### Testing Configuration

To test your configuration:

1. Save your MCP configuration
2. Restart your MCP client (Cursor/Claude Desktop)
3. Use the `athena_health_check` tool to verify configuration
4. Check the server logs for any error messages

### Getting Help

If you encounter issues:

1. Check the [GitHub Issues](https://github.com/n0zer0d4y/athena-protocol/issues) for similar problems
2. Provide your configuration (with API keys redacted) when reporting issues
3. Include error messages and which MCP client you're using

## Environment Variable Reference

### Required Variables
- `DEFAULT_LLM_PROVIDER`: Primary provider name
- `PROVIDER_SELECTION_PRIORITY`: Comma-separated provider list
- At least one API key (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)

### Optional Variables
- Provider-specific models (e.g., `OPENAI_MODEL`, `ANTHROPIC_MODEL`)
- Performance settings (`LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `LLM_TIMEOUT`)
- GPT-5 parameters (`OPENAI_MAX_COMPLETION_TOKENS`, `OPENAI_VERBOSITY`, `OPENAI_REASONING_EFFORT`)

See the main README for complete environment variable documentation.
