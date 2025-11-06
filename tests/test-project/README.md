# Test Project - MCP Server Analysis Testing

## Overview

This directory contains a **deliberately flawed Node.js/Express API project** designed specifically for testing the MCP server's code analysis capabilities. The codebase contains **intentional architectural inconsistencies, security vulnerabilities, and interconnected bugs** that require cross-file analysis to discover.

## ⚠️ Important Notes

- **DO NOT USE THIS CODE IN PRODUCTION** - It contains intentional security flaws and architectural problems
- **Lint errors are expected** - The code is designed to have issues for testing purposes
- **This is test infrastructure** - Used by automated tests in the MCP server test suite

## Architecture Overview

### Core Components

#### `src/server.js`

- Main Express server with MongoDB integration
- Contains deliberate middleware ordering issues
- Includes intentionally vulnerable authentication endpoints
- Demonstrates inconsistent error handling patterns

#### `src/routes/user.js`

- User authentication routes (registration/login/profile)
- Features multiple JWT secret inconsistencies across endpoints
- Contains password hashing round mismatches
- Shows different validation logic between similar operations

#### `src/middleware/auth.js`

- Authentication middleware with utility imports
- Demonstrates inconsistent rate limiting implementations
- Contains validation rule differences from other components

#### `src/utils/auth.js`

- Authentication utility functions
- Shows different bcrypt rounds and JWT secret usage
- Contains helper functions with inconsistent implementations

#### `src/config/index.js`

- Configuration management with conflicting settings
- Demonstrates CORS policy inconsistencies
- Contains overlapping rate limiting configurations

## Test Usage

This project is used by the following test scripts:

- `tests/validate-tool-architecture.cjs` - Architecture validation testing
- `tests/test-mcp-thinking-validation.js` - MCP thinking tool validation
- `tests/simple-thinking-test.js` - Basic thinking validation tests

## Known Issues (Intentional)

### Security Vulnerabilities

- Multiple JWT secrets used inconsistently
- Hardcoded fallback secrets
- Inconsistent password hashing rounds

### Architectural Problems

- Middleware applied in wrong order
- Database vs in-memory storage conflicts
- Inconsistent error handling patterns

### Code Quality Issues

- Mixed validation rules across components
- Conflicting configuration values
- Deliberate import/export mismatches

## Purpose

This test project enables the MCP server to demonstrate:

- **Cross-file pattern recognition** - Connecting issues across multiple files
- **Architectural analysis** - Understanding system-wide inconsistencies
- **Security vulnerability detection** - Finding authentication flaws
- **Dependency mapping** - Tracing interconnected component relationships

## Maintenance

When modifying this test project:

1. Ensure bugs remain discoverable through code analysis (no explicit comments)
2. Maintain cross-file dependencies and inconsistencies
3. Keep the project runnable for automated testing
4. Update test scripts if file paths change

---

**Remember:** This is intentionally broken code for testing purposes. The "errors" you see are the test cases themselves! 🔧
