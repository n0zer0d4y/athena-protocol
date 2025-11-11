# Provider Configuration Guide - Athena Protocol MCP Server

This guide provides comprehensive instructions for configuring different LLM providers for your Athena Protocol MCP Server.

## Quick Provider Setup

### Current Status

- **Default Provider**: OpenAI (GPT-5) - **API Key Required**
- **Available Providers**: 14 providers including OpenAI, Anthropic, Google, Azure, AWS Bedrock, OpenRouter, Qwen, Groq, xAI, Mistral, Perplexity, Ollama, Vertex AI, and more
- **Required**: At least one provider API key configured
- **Critical**: Restart MCP client after configuration changes

### 30-Second Provider Setup

```bash
# 1. Edit .env file
nano .env  # or use your preferred editor

# 2. Add your API key and configure provider
OPENAI_API_KEY=sk-your-openai-api-key-here
DEFAULT_LLM_PROVIDER=openai

# 3. Restart server and MCP client
npm run build
npm start
# IMPORTANT: Restart your MCP client (Claude Desktop, Qoder IDE, etc.)
```

## Critical: MCP Client Restart Required

**After any `.env` configuration changes, you must restart your MCP client completely:**

- **Claude Desktop**: Quit and restart the application
- **Qoder IDE**: Close and reopen the IDE
- **VS Code with Cline**: Restart VS Code
- **Other MCP clients**: Complete application restart

**Why?** MCP clients cache configuration values. Server rebuilds alone won't update cached values in the client.

## Detailed Provider Configuration

### 1. OpenAI (GPT-5) - Primary Provider

**Get API Key:**

1. Visit [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)

**Configure in .env:**

```bash
# OpenAI Configuration (Primary Provider)
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-5                    # or gpt-4o, gpt-3.5-turbo
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
OPENAI_TIMEOUT=30000

# Set as default
DEFAULT_LLM_PROVIDER=openai
```

**Available Models:**

- `gpt-5` (latest with unified thinking mode, recommended)
- `gpt-4o` (multimodal model)
- `gpt-4-turbo` (faster GPT-4)
- `gpt-3.5-turbo` (faster, less expensive)

**Cost Considerations:**

- GPT-5: Pricing varies by usage tier
- GPT-4o: ~$0.005/1K tokens (input), $0.015/1K tokens (output)
- GPT-3.5-turbo: ~$0.001/1K tokens (much cheaper)

### 2. Anthropic (Claude) - High Quality Analysis

**Get API Key:**

1. Visit [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Sign in or create account
3. Click "Create Key"
4. Copy the key (starts with `sk-ant-`)

**Configure in .env:**

```bash
# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
ANTHROPIC_MODEL=claude-sonnet-4.5
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=2000
ANTHROPIC_TIMEOUT=30000

# Set as default
DEFAULT_LLM_PROVIDER=anthropic
```

**Available Models:**

- `claude-sonnet-4.5` (latest, September 2025)
- `claude-opus-4.1` (highest quality, August 2025)
- `claude-haiku-4.5` (fastest, October 2025)

**Cost Considerations:**

- Claude Sonnet 4.5: Pricing varies, check Anthropic pricing page
- Claude Opus 4.1: Higher tier pricing for maximum quality
- Claude Haiku 4.5: Most cost-effective option

### 3. Google (Gemini) - Advanced Reasoning

**Get API Key:**

1. Visit [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

**Configure in .env:**

```bash
# Google AI Configuration
GOOGLE_AI_API_KEY=your-google-api-key-here
GOOGLE_AI_MODEL=gemini-2.5-pro
GOOGLE_AI_TEMPERATURE=0.7
GOOGLE_AI_MAX_TOKENS=2000
GOOGLE_AI_TIMEOUT=30000

# Set as default
DEFAULT_LLM_PROVIDER=google
```

**Available Models:**

- `gemini-2.5-pro` (latest, June 2025, recommended)
- `gemini-2.5-flash` (fastest, most efficient)

**Cost Considerations:**

- Gemini 2.5 Flash: Very cost-effective for high-volume usage
- Gemini 2.5 Pro: Balanced pricing for general use
- Gemini 2.5 Ultra: Premium pricing for highest quality

### 4. OpenRouter - Multiple Models Access

**Get API Key:**

1. Visit [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign in or create account
3. Click "Create Key"
4. Copy the key (starts with `sk-or-`)

**Configure in .env:**

```bash
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-your-openrouter-api-key-here
OPENROUTER_MODEL=anthropic/claude-sonnet-4.5
OPENROUTER_TEMPERATURE=0.7
OPENROUTER_MAX_TOKENS=2000
OPENROUTER_TIMEOUT=30000

# Set as default
DEFAULT_LLM_PROVIDER=openrouter
```

**Popular Models via OpenRouter (400+ models available):**

- `anthropic/claude-sonnet-4.5`
- `openai/gpt-5`
- `google/gemini-2.5-pro`
- `meta-llama/llama-3.3-70b`
- `qwen/qwen-3-235b`

### 5. Qwen - Alibaba's LLM

**Get API Key:**

1. Visit [https://dashscope.console.aliyun.com/](https://dashscope.console.aliyun.com/)
2. Sign in or create Alibaba Cloud account
3. Get API key from dashboard
4. Copy the key

**Configure in .env:**

```bash
# Qwen Configuration
QWEN_API_KEY=your-qwen-api-key-here
QWEN_MODEL=qwen-3-4b
QWEN_TEMPERATURE=0.7
QWEN_MAX_TOKENS=2000
QWEN_TIMEOUT=30000

# Set as default
DEFAULT_LLM_PROVIDER=qwen
```

**Available Models:**

- `qwen-3-235b-a22b` (latest MoE, 235B parameters with 22B active)
- `qwen-3-30b-a3b` (MoE, 30B parameters with 3B active)
- `qwen-3-4b` (dense model, efficient)
- `qwen-turbo` (fast and efficient, previous generation)
- `qwen-plus` (balanced, previous generation)
- `qwen-max` (highest quality, previous generation)

## Advanced Multi-Provider Setup

### Multiple Providers Configuration

You can configure multiple providers and switch between them:

```bash
# Configure multiple providers
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GOOGLE_AI_API_KEY=your-google-key

# Set primary default
DEFAULT_LLM_PROVIDER=openai

# Use different providers for different tools
# (specify in tool calls)
```

### Provider-Specific Tool Usage

**Using thinking_validation with specific provider:**

```json
{
  "thinking": "I plan to refactor this component to use hooks",
  "proposedChange": {
    "description": "Convert class component to functional component with hooks",
    "files": ["UserProfile.js"]
  },
  "context": {
    "problem": "Component is hard to test and maintain",
    "techStack": "react"
  },
  "urgency": "medium",
  "provider": "anthropic" // Force use Anthropic
}
```

**Provider fallback in impact_analysis:**

```json
{
  "change": {
    "description": "Refactor UserProfile to use hooks",
    "files": ["UserProfile.js"]
  },
  "systemContext": {
    "architecture": "React app with Redux store",
    "keyDependencies": ["UserService", "AuthContext"]
  },
  "provider": "google" // Use Google Gemini
}
```

## Testing Provider Configuration

### 1. Verify Configuration Loading

```bash
# Check .env file exists and has correct format
cat .env

# Look for these lines:
# OPENAI_API_KEY=sk-...
# DEFAULT_LLM_PROVIDER=openai

# Test configuration loading
npm run build
npm test
```

### 2. Health Check All Providers

Use the MCP client to call:

```json
{
  "tool": "health_check",
  "arguments": {}
}
```

### 3. List Provider Status

```json
{
  "tool": "list_providers",
  "arguments": {}
}
```

**Expected Output:**

```
✅ openai
   - Model: gpt-4
   - API Key: Configured ✓
   - Temperature: 0.7
```

## Troubleshooting Provider Issues

### Common Problems & Solutions

#### 1. Invalid API Key Errors

```
Error: Invalid OpenAI API key
```

**Solution:**

- Verify API key is correct in `.env`
- Check if key has expired
- Ensure no extra spaces or quotes
- Restart server after changes

#### 2. Rate Limit Exceeded

```
Error: Rate limit exceeded
```

**Solution:**

- Wait before retrying
- Check your API usage dashboard
- Consider upgrading API plan
- Switch to different provider temporarily

#### 3. Provider Unavailable

```
Error: Provider not available
```

**Solution:**

- Check if API key is configured
- Verify provider SDK is installed
- Test network connectivity
- Try fallback provider

#### 4. Model Not Found

```
Error: Model 'gpt-5' not found
```

**Solution:**

- Use correct model names (see provider sections above)
- Check provider documentation for available models
- Update model name in `.env`

### Provider Debugging Commands

**Check configuration loading:**

```bash
# View current .env file
cat .env

# Check for common issues
grep -v "^#" .env | grep -v "^$"  # Show only active config lines

# Verify API key format
echo $OPENAI_API_KEY | wc -c  # Should be ~51-52 characters for OpenAI

# Test build and configuration
npm run build
npm test
```

**Test specific provider:**

```bash
# Test OpenAI connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}],"max_tokens":5}' \
     https://api.openai.com/v1/chat/completions
```

**Debug MCP client communication:**

```bash
# Start server with debug output
LOG_LEVEL=debug npm start

# In another terminal, check if process is running
ps aux | grep "node.*index.js"
```

## Recommended Usage by Scenario

**Complex Thinking Validation (High Stakes, Code Review):**

- Primary: `openai` (GPT-5 with thinking) - State-of-the-art reasoning
- Fallback: `anthropic` (Claude Opus 4.1) - Excellent for code analysis

**Fast Development Thinking Validation (Daily Use):**

- Primary: `google` (Gemini 2.5 Flash) - Very fast and efficient
- Fallback: `anthropic` (Claude Haiku 4.5) - Fast and accurate

**Cost-Effective Thinking Validation (High Volume):**

- Primary: `google` (Gemini 2.5 Pro) - Excellent value
- Fallback: `qwen` (Qwen-3-4b) - Very affordable

**Maximum Model Variety & Experimentation:**

- Primary: `openrouter` (access to 400+ models)
- Fallback: `anthropic` (Claude Sonnet 4.5)

**Enterprise/Production Thinking Validation:**

- Primary: `openai` (GPT-5) - Most advanced and reliable
- Fallback: `anthropic` (Claude Sonnet 4.5) - Excellent analysis

## Complete .env Template

```bash
################################################################################
# ATHENA PROTOCOL MCP SERVER - Environment Configuration
################################################################################

# DEPLOYMENT INSTRUCTIONS:
# 1. Copy this file to .env:  cp .env.example .env
# 2. Configure your settings below
# 3. Add ONLY the API keys for providers you want to use
# 4. Customize parameters as needed for your use case

# ARCHITECTURE: No hardcoded defaults - everything is configurable here.
# HIERARCHY: User overrides > Global settings > Environment defaults
# CURRENTLY IMPLEMENTED: 7 providers (anthropic, openai, google, groq, xai, openrouter, qwen)

################################################################################

# ==========================================
# PROVIDER SELECTION (REQUIRED)
# ==========================================
# Provider selection priority (comma-separated, no spaces around commas)
# This determines the order in which providers are tried when selecting the best available provider
PROVIDER_SELECTION_PRIORITY=openai,google,openrouter,zai,anthropic,groq,xai,qwen,mistral,perplexity,azure,bedrock,vertex,ollama

# ==========================================
#  CORE SYSTEM CONFIGURATION
# ==========================================
# CRITICAL: Set your primary LLM provider (affects entire system behavior)

# Default Provider Selection
# Available: anthropic, openai, google, groq, xai, openrouter, qwen
# Note: Only these 7 providers are currently implemented
DEFAULT_LLM_PROVIDER=openai

# Environment Settings
NODE_ENV=development    # Default: Full logging, error details, dev optimizations
# NODE_ENV=production   # Optimized: Minimal logging, performance focus, security hardened
# NODE_ENV=test         # Testing: Special test configurations, mock services
# NODE_ENV=staging      # Pre-prod: Production-like but with extra logging

# DEBUG: Controls logging verbosity
DEBUG=0    # Default: Standard logging only
# DEBUG=1  # Verbose: Detailed debugging information
# DEBUG=2  # Ultra-verbose: Everything including API requests/responses

# CONFIG_UNIFIED: Feature flag for Unified Configuration System
# Enables advanced features like GPT-5 parameters, enhanced provider support
# Required for GPT-5 models to use specialized parameters (maxCompletionTokens, verbosity, reasoningEffort)
# When disabled, falls back to legacy configuration (missing GPT-5 features)
CONFIG_UNIFIED=1    # Enable unified config system (recommended)
# CONFIG_UNIFIED=0    # Disable unified config (legacy mode)

# Additional Environment Options (uncomment if needed)
# PORT=3000                    # Server port (if applicable)
# LOG_LEVEL=info              # Logging level: error, warn, info, debug
# PERFORMANCE_MONITORING=true # Enable performance tracking

# ==========================================
# 🔐 API KEYS - PRIMARY PROVIDERS
# ==========================================
# Configure ONLY the providers you intend to use
# Remove or comment out unused providers to avoid confusion

# Anthropic Claude (Recommended for reasoning tasks)
# Registration: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OpenAI GPT (Supports GPT-4, GPT-4o, GPT-5)
# Registration: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Google Gemini (Fast and cost-effective)
# Registration: https://makersuite.google.com/app/apikey
GOOGLE_API_KEY=your_google_api_key_here

# ==========================================
# 🔐 API KEYS - SECONDARY PROVIDERS
# ==========================================

# Groq (Ultra-fast inference)
# Registration: https://console.groq.com/keys
GROQ_API_KEY=your_groq_api_key_here

# xAI Grok (Elon Musk's AI)
# Registration: https://x.ai/api
XAI_API_KEY=your_xai_api_key_here

# OpenRouter (Multi-model access)
# Registration: https://openrouter.ai/keys
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Perplexity (Research-focused)
# Registration: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Mistral AI (Fast, cost-effective French AI)
# Registration: https://console.mistral.ai/api-keys
MISTRAL_API_KEY=your_mistral_api_key_here

# ==========================================
# 🔐 API KEYS - SPECIALIZED PROVIDERS
# ==========================================

# Ollama (Local AI - usually no key required)
# Only needed if using authentication
OLLAMA_API_KEY=your_ollama_api_key_here

# Z.AI (Chinese AI provider)
# Registration: https://z.ai/manage-apikey/apikey-list
ZAI_API_KEY=your_zai_api_key_here

# Azure OpenAI (Enterprise)
# Setup: https://portal.azure.com/
AZURE_API_KEY=your_azure_api_key_here
AZURE_ENDPOINT=your_azure_endpoint_here

# Amazon Bedrock (Enterprise)
# Setup: https://console.aws.amazon.com/bedrock/
BEDROCK_API_KEY=your_bedrock_api_key_here
AWS_REGION=your_aws_region_here

# Google Vertex AI (Enterprise)
# Setup: https://console.cloud.google.com/
VERTEX_API_KEY=your_vertex_api_key_here
VERTEX_PROJECT_ID=your_vertex_project_id_here

# ==========================================
#  MODEL CONFIGURATION
# ==========================================
# Specify exact models for each provider (uncomment to customize)

# Primary Providers - Model Overrides
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
# OPENAI_MODEL=gpt-4o
# GOOGLE_MODEL=gemini-1.5-pro

# Secondary Providers - Model Overrides
# GROQ_MODEL=llama-3.1-70b-versatile
# XAI_MODEL=grok-2
# OPENROUTER_MODEL=openai/gpt-4o
# QWEN_MODEL=qwen-turbo

# ==========================================
# 🔧 MODEL DEFAULTS (SYSTEM-DEFINED)
# ==========================================
# These are fallback values - modify above overrides instead

# Primary Provider Defaults
ANTHROPIC_MODEL_DEFAULT=claude-4-sonnet
OPENAI_MODEL_DEFAULT=gpt-5
GOOGLE_MODEL_DEFAULT=gemini-2.5-flash

# Secondary Provider Defaults
GROQ_MODEL_DEFAULT=deepseek-r1-distill-llama-70b
XAI_MODEL_DEFAULT=
OPENROUTER_MODEL_DEFAULT=deepseek/deepseek-chat-v3.1:free
PERPLEXITY_MODEL_DEFAULT=
MISTRAL_MODEL_DEFAULT=devstral-medium-2507

# Specialized Provider Defaults
OLLAMA_MODEL_DEFAULT=
ZAI_MODEL_DEFAULT=glm-4.5-flash
AZURE_MODEL_DEFAULT=
BEDROCK_MODEL_DEFAULT=
VERTEX_MODEL_DEFAULT=

# ==========================================
#  PERFORMANCE & BEHAVIOR PARAMETERS
# ==========================================

# Global LLM Parameters (apply to all providers unless overridden)
# Uncomment and modify these to customize behavior
# LLM_TEMPERATURE=0.7         # Creativity (0.0-1.0): 0.3=precise, 0.7=balanced, 0.9=creative
# LLM_MAX_TOKENS=2000         # Response length limit
# LLM_TIMEOUT=30000          # Request timeout (milliseconds)

# Provider-Specific Parameter Overrides
# Uncomment to override global settings for specific providers
# ANTHROPIC_TEMPERATURE=0.8   # Claude works well with slightly higher temperature
# OPENAI_TEMPERATURE=0.7      # GPT-4 balanced setting
# GOOGLE_TEMPERATURE=0.6      # Gemini optimal setting
# GROQ_MAX_TOKENS=4000       # Higher token limit for longer responses
# OPENAI_TIMEOUT=60000       # Longer timeout for complex requests

# ==========================================
#  SYSTEM DEFAULTS (PERFORMANCE-TUNED)
# ==========================================
# Core performance parameters - modify above overrides instead

LLM_TEMPERATURE_DEFAULT=0.7
LLM_MAX_TOKENS_DEFAULT=2000
LLM_TIMEOUT_DEFAULT=30000

# ==========================================
#  GPT-5 ADVANCED PARAMETERS
# ==========================================
# Advanced parameters for GPT-5 models (auto-detected by \"gpt-5\" prefix)

# GPT-5 Parameter Overrides (uncomment to customize)
# OPENAI_MAX_COMPLETION_TOKENS=8000    # Visible output tokens (replaces max_tokens)
# OPENAI_VERBOSITY=high               # Response detail: low, medium, high
# OPENAI_REASONING_EFFORT=high        # Internal thinking: minimal, low, medium, high

# GPT-5 System Defaults
OPENAI_MAX_COMPLETION_TOKENS_DEFAULT=8192
OPENAI_VERBOSITY_DEFAULT=medium
OPENAI_REASONING_EFFORT_DEFAULT=high

# ==========================================
#  PERFORMANCE OPTIMIZATION SETTINGS
# ==========================================
# Connection pooling settings
CONNECTION_POOL_ENABLED=true
CONNECTION_POOL_MAX_CONNECTIONS=10
CONNECTION_POOL_KEEP_ALIVE=60000

# Client caching settings
CLIENT_CACHE_ENABLED=true
CLIENT_CACHE_TTL=1800000
CLIENT_MAX_CACHE_SIZE=100

# Environment cache settings
ENV_CACHE_TTL=30000

# ==========================================
#  ENTERPRISE USE CASE TEMPLATES
# ==========================================
# Copy and uncomment the configuration that matches your use case

#  CREATIVE WRITING & CONTENT GENERATION
# Optimized for creative tasks, storytelling, marketing copy
# LLM_TEMPERATURE=0.9              # High creativity
# ANTHROPIC_TEMPERATURE=0.8        # Claude optimized for creativity
# LLM_MAX_TOKENS=3000             # Longer responses
# DEFAULT_LLM_PROVIDER=openai   # Claude excels at creative tasks

#  SOFTWARE DEVELOPMENT & CODE GENERATION
# Optimized for precise code generation, technical documentation
# LLM_TEMPERATURE=0.3              # Low temperature for precision
# LLM_MAX_TOKENS=4000             # Longer code blocks
# OPENAI_MAX_TOKENS=4000          # GPT-4 optimized for code
# LLM_TIMEOUT=60000               # Longer timeout for complex code
# DEFAULT_LLM_PROVIDER=openai     # GPT-4 excellent for code

#  BUSINESS ANALYSIS & RESEARCH
# Optimized for data analysis, research, structured outputs
# LLM_TEMPERATURE=0.5              # Balanced creativity and precision
# LLM_MAX_TOKENS=3000             # Detailed analysis
# GOOGLE_TEMPERATURE=0.4          # Gemini optimized for analysis
# DEFAULT_LLM_PROVIDER=google      # Fast and cost-effective

#  HIGH-PERFORMANCE PRODUCTION
# Optimized for speed and cost-effectiveness
# LLM_TEMPERATURE=0.7              # Balanced setting
# LLM_MAX_TOKENS=2000             # Standard length
# LLM_TIMEOUT=15000               # Fast timeout
# GROQ_TIMEOUT=10000              # Ultra-fast responses
# DEFAULT_LLM_PROVIDER=groq       # Fastest inference

#  GPT-5 MAXIMUM REASONING
# Utilizes GPT-5's advanced reasoning capabilities
# OPENAI_MAX_COMPLETION_TOKENS=8000    # Maximum output
# OPENAI_VERBOSITY=high               # Detailed explanations
# OPENAI_REASONING_EFFORT=high        # Deep internal thinking
# LLM_TIMEOUT=120000                  # Extended timeout for reasoning
# DEFAULT_LLM_PROVIDER=openai         # GPT-5 provider

#  ENTERPRISE MULTI-PROVIDER
# Balanced configuration for enterprise deployments
# LLM_TEMPERATURE=0.7              # Professional balance
# LLM_MAX_TOKENS=2500             # Adequate length
# LLM_TIMEOUT=45000               # Reasonable timeout
# ANTHROPIC_TEMPERATURE=0.8        # Claude for reasoning
# OPENAI_MAX_TOKENS=3000          # GPT for code
# GOOGLE_TEMPERATURE=0.6          # Gemini for analysis

# ==========================================
# TOOL CALLING CONFIGURATION
# ==========================================
# Function/Calling Tools for Enhanced LLM Responses
# These tools allow the LLM to analyze actual project files during thinking validation
# ALL TOOLS ARE DISABLED BY DEFAULT FOR SECURITY
# File Reading Tools (recommended for most use cases - low risk)
# Enable these for enhanced context gathering and code analysis
TOOL_CALLING_READ_FILE_ENABLED=true # Read individual file contents
TOOL_CALLING_SEARCH_FILES_ENABLED=true # Search patterns across files
TOOL_CALLING_LIST_FILES_ENABLED=true # List directory contents

# File Writing Tools (use with caution - high risk)
# Only enable if you need the LLM to modify files
TOOL_CALLING_WRITE_TO_FILE_ENABLED=false # Create or overwrite files
TOOL_CALLING_REPLACE_IN_FILE_ENABLED=false # Make targeted file edits

# System Tools (highest risk - critical)
# Only enable for trusted environments with proper security measures
TOOL_CALLING_EXECUTE_COMMAND_ENABLED=true # Execute terminal commands

# Tool Safety Limits
TOOL_CALLING_MAX_FILE_SIZE_KB=1024 # Maximum file size for reading (1MB)
TOOL_CALLING_MAX_EXECUTION_TIME_SEC=300 # Maximum execution time per operation
TOOL_CALLING_ALLOWED_FILE_EXTENSIONS=.js,.jsx,.ts,.tsx,.mjs,.cjs,.d.ts,.d.tsx,.html,.htm,.xhtml,.css,.scss,.sass,.less,.styl,.vue,.svelte,.astro,.py,.pyc,.pyo,.pyd,.rb,.rbw,.php,.phtml,.java,.class,.cs,.csx,.go,.rs,.swift,.kt,.kts,.json,.jsonc,.yml,.yaml,.xml,.xsd,.toml,.ini,.cfg,.md,.markdown,.txt,.rst,.adoc,.tex,.package.json,.package-lock.json,.yarn.lock,.pnpm-lock.yaml,.requirements.txt,.pipfile,.Pipfile.lock,.Gemfile,.Gemfile.lock,.composer.json,.composer.lock,.pom.xml,.build.gradle,.gradle.kts,.csproj,.fsproj,.vbproj,.Cargo.toml,.Cargo.lock,.go.mod,.go.sum,.webpack,.babelrc,.eslintrc,.prettierrc,.dockerfile,.Dockerfile,.docker-compose.yml,.Makefile,.makefile,.sql,.prisma,.sh,.bash,.zsh,.ps1,.bat,.cmd

# Command Execution Security
#
# Whitelist of allowed commands for the execute_command tool.
# Commands must match exactly from the start of the executed command.
# Separate multiple commands with commas.

TOOL_CALLING_ALLOWED_COMMANDS=node --version,npm --version,python --version,pip --version,git --version,java -version,mvn --version,gradle --version,docker --version,echo,pwd,ls,dir,type,cat,head,tail,find,grep,wc,du,df,ps,uname,whoami,id,date,uptime,hostname,ping -c 1,ping -n 1,curl --version,wget --version,tar --version,zip --version,unzip -l,gzip --version,bzip2 --version,xz --version,make --version,gcc --version,g++ --version,clang --version,rustc --version,cargo --version,go version,dotnet --version,php --version,composer --version,ruby --version,gem --version,perl --version,sqlite3 --version,mysql --version,psql --version,redis-cli --version,mongo --version,kubectl version,helm version,docker-compose --version,kafka-topics.sh --version,zookeeper-shell.sh,elasticsearch --version,kibana --version,logstash --version

# Reference: Common Safe Commands (add to TOOL_CALLING_ALLOWED_COMMANDS as needed)
#
# System Information:
# node --version # Check Node.js version
# npm --version # Check npm version
# python --version # Check Python version
# git --version # Check Git version
# which <command> # Find command location
# where <command> # Windows equivalent of which
#
# Directory Operations:
# pwd # Print working directory
# ls # List directory contents (Unix/Linux)
# ls -la # List all files with details
# dir # List directory contents (Windows)
# dir /w # Wide directory listing (Windows)
# find . -name "\*.js" # Find files by pattern
#
# File Operations:
# cat <file> # Display file contents (Unix/Linux)
# type <file> # Display file contents (Windows)
# head <file> # Show first 10 lines of file
# tail <file> # Show last 10 lines of file
# wc -l <file> # Count lines in file
#
# Simple Utilities:
# echo <text> # Print text to console
# date # Show current date/time
# time # Show current time (Windows)
# whoami # Show current user
#
# Development Tools:
# npm list # List installed npm packages
# npm outdated # Check for outdated packages
# git status # Show git repository status
# git log --oneline -5 # Show recent git commits
#
# ⚠️ SECURITY WARNING:
# Only add commands that are safe for automated execution.
# Avoid commands that modify files, install software, or access sensitive data.
# Commands should be informational/read-only operations only.

# Tool-Specific Timeout Configuration (in milliseconds)
#
# These control individual tool timeouts to prevent long-running operations
# from causing MCP client timeouts. Adjust based on your environment and
# expected file sizes/processing complexity.

TOOL_TIMEOUT_THINKING_VALIDATION_MS=300000  # 5 minutes - Basic validation
TOOL_TIMEOUT_IMPACT_ANALYSIS_MS=300000      # 5 minutes - File analysis heavy
TOOL_TIMEOUT_ASSUMPTION_CHECKER_MS=300000   # 5 minutes - Logic validation
TOOL_TIMEOUT_DEPENDENCY_MAPPER_MS=300000    # 5 minutes - Dependency analysis
TOOL_TIMEOUT_THINKING_OPTIMIZER_MS=300000   # 5 minutes - Optimization logic

################################################################################
# END OF CONFIGURATION
################################################################################
```

## Quick Start Commands

```bash
# 1. Copy template and configure
cp .env.example .env
nano .env  # Add your API keys

# 2. Install and build
npm install
npm run build

# 3. Test configuration
npm test

# 4. Start MCP server
npm start

# 5. Check providers work
# Use list_providers and health_check tools in your MCP client
```

---

**Need Help?**

- Check the main README.md for basic setup
- Use the `health_check` tool to diagnose provider issues
- Use the `list_providers` tool to see current configuration
- All tools work with any configured provider
