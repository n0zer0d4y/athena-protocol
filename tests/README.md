# Test Suite

This directory contains test files for the Athena Protocol MCP Server.

## Test Files

### `simple-thinking-test.js`

**Purpose**: Direct integration test for thinking validation tools
**What it tests**: Calls MCP tools directly to validate thinking processes with file analysis
**Usage**: `node tests/simple-thinking-test.js`

### `test-all-tools.js`

**Purpose**: Unit tests for internal tool registry
**What it tests**: Individual tool functionality (readFile, grep, listFiles, etc.)
**Usage**: `node tests/test-all-tools.js`

### `test-integration.js`

**Purpose**: Tool calling service integration tests
**What it tests**: Tool calling service with configuration loading
**Usage**: `node tests/test-integration.js`

### `test-mcp-client.js`

**Purpose**: MCP client functionality tests
**What it tests**: MCP protocol communication with server
**Usage**: `node tests/test-mcp-client.js`

### `test-mcp-thinking-validation.js`

**Purpose**: End-to-end MCP server thinking validation
**What it tests**: Full MCP server process with thinking validation tools
**Usage**: `node tests/test-mcp-thinking-validation.js`

## Running Tests

```bash
# Run all tests
npm test

# Run specific test
node tests/simple-thinking-test.js

# Build and test
npm run build && npm test
```

## Test Project

The `test-project/` directory contains sample files used for testing file analysis capabilities. It includes:

- `package.json` - Sample Node.js project configuration
- `src/server.js` - Express server with unprotected routes
- `src/routes/user.js` - User authentication routes with security issues

This allows testing of the MCP server's ability to read and analyze real project code.
