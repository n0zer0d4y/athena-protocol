# Athena Protocol MCP Server

A comprehensive MCP server that harmonizes the Athena Protocol thinking validation system with internal file system tools. This server provides AI-powered thinking validation, impact analysis, assumption checking, dependency mapping, and thinking optimization, with full access to client project files for comprehensive code analysis.

## Features

,### 🧠 Athena Protocol Thinking Validation

- **thinking_validation**: Validate reasoning processes before action
- **impact_analysis**: Analyze change impacts on system architecture
- **assumption_checker**: Validate key assumptions with evidence
- **dependency_mapper**: Identify critical dependencies and relationships
- **thinking_optimizer**: Optimize thinking approaches based on problem type

### 🔧 Integrated File System Tools

The thinking validation tools have full access to client project files:

#### File Analysis Capabilities

- **Project Structure Analysis**: Automatically analyze project layout and key files
- **Code Reading**: Read and analyze source files for context
- **Content Search**: Search through codebases using regex patterns
- **Directory Traversal**: Navigate and understand project hierarchies

#### Supported Operations

- Read individual files or multiple files efficiently
- Search for content patterns across entire projects
- List directory contents with recursive support
- Analyze file relationships and dependencies

### 🎯 MCP Client Integration

- **Direct Tool Access**: MCP clients can call Athena Protocol tools directly
- **Project Context**: Tools receive projectRoot, filesToAnalyze, and workingDirectory
- **File-Based Analysis**: Internal tools analyze client projects for comprehensive validation
- **Session Management**: Maintains validation history and context across sessions

## Setup

### Prerequisites

- Node.js 20 or higher
- Google API key for Gemini AI

### Installation

1. Clone or download the project
2. Install dependencies:

```bash
npm install
```

3. Configure environment variables:

```bash
cp .env.example .env
```

4. Edit `.env` file with your Google API key:

```env
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Running the Server

#### Development Mode

```bash
npm run dev
```

#### Production Mode

```bash
npm run build
npm start
```

## MCP Client Configuration

To use this MCP server with an MCP client (like Claude Desktop or other AI coding agents), configure the client to connect to this server using stdio transport.

### Example Configuration (Claude Desktop)

Add this configuration to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "athena-protocol": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/athena-protocol-mcp-server",
      "type": "stdio",
      "timeout": 60,
      "autoApprove": [
        "thinking_validation",
        "impact_analysis",
        "assumption_checker",
        "dependency_mapper",
        "thinking_optimizer"
      ]
    }
  }
}
```

**Important Notes:**

- Replace `/absolute/path/to/athena-protocol-mcp-server` with the actual absolute path to this project
- The server already contains API keys in its `.env` file, so no additional environment variables are needed
- The `autoApprove` setting allows the thinking validation tools to run without manual approval
- The server must be built first with `npm run build` before use

## Usage

### Basic Chat

The server exposes a single `chat` tool that accepts natural language messages:

```json
{
  "name": "chat",
  "arguments": {
    "message": "Help me understand the structure of this project",
    "context": "Previous conversation context (optional)"
  }
}
```

### Example Interactions

#### Project Analysis

```
User: "Analyze this codebase and tell me what it does"
AI: "I'll analyze the project structure and code to understand its purpose..."
```

#### Code Implementation

```
User: "Add a new feature to validate user input"
AI: "I'll help you implement user input validation. Let me first explore the codebase..."
```

#### Debugging

```
User: "There's a bug in the login function"
AI: "I'll help you debug the login function. Let me examine the relevant files..."
```

#### File Operations

```
User: "Create a new utility function for date formatting"
AI: "I'll create a date formatting utility function for you..."
```

## Customization

### System Prompts

You can customize the AI's behavior by modifying the system prompt in `src/mcp-server/prompts/system-prompt.ts`. The prompt defines:

- AI capabilities and available tools
- Guidelines for task execution
- Example workflows
- Behavioral constraints

### Environment Variables

- `GOOGLE_API_KEY`: Your Google API key for Gemini AI
- `GEMINI_MODEL`: The Gemini model to use (default: gemini-2.0-flash-exp)
- `DEBUG`: Enable debug logging (default: false)
- `LOG_LEVEL`: Logging level (default: info)

## Project Structure

```
src/mcp-server/
├── index.ts              # Main MCP server entry point
├── core/
│   └── llm-agent.ts      # LLM agent implementation
├── internal-tools/       # Internal tools for AI agent
│   ├── tool-registry.ts  # Tool registry
│   ├── read-file.ts      # File reading
│   ├── write-file.ts     # File writing
│   ├── list-files.ts     # Directory listing
│   ├── read-many-files.ts # Multiple file reading
│   ├── glob.ts          # Glob pattern matching
│   ├── grep.ts          # Content search
│   ├── execute-shell.ts # Shell execution
│   ├── git-operation.ts # Git operations
│   └── web-search.ts    # Web search
├── prompts/
│   └── system-prompt.ts # System prompts
└── utils/
    └── logger.ts        # Logging utilities
```

## Development

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Testing

The server can be tested by running it and connecting with an MCP client.

## Security Considerations

- The server executes shell commands - ensure proper access controls
- File operations are restricted to the file system the server has access to
- API keys should be kept secure and not committed to version control
- Consider running the server in a sandboxed environment for production use

## License

This project is licensed under the Apache 2.0 License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please refer to the project documentation or create an issue in the repository.
