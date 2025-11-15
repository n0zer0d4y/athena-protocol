# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-11-15

### Added

- MCP client environment variable configuration support for npm/npx usage
- GPT-5 specific parameter support (`OPENAI_MAX_COMPLETION_TOKENS_DEFAULT`, `OPENAI_VERBOSITY_DEFAULT`, `OPENAI_REASONING_EFFORT_DEFAULT`)
- Google Gemini model support for MCP clients
- Comprehensive MCP configuration examples documentation
- Environment variable priority system (MCP env > .env file > system env)

### Changed

- Simplified MCP configuration to only include tested working examples
- Updated documentation to clearly separate local vs npm installation methods
- Removed complex multi-provider configurations from main README
- Consolidated all MCP client configurations into dedicated documentation file

### Fixed

- MCP client configuration validation issues
- Environment variable loading order for npx execution
- GPT-5 model parameter handling in MCP context

### Security

- Enhanced security by recommending MCP environment variables over .env files for npm usage
- Clear separation of local development vs production MCP usage patterns

## [0.1.6] - 2025-11-15

### Fixed

- Resolved MCP server initialization issues
- Fixed environment provider loading order
- Corrected GPT-5 parameter validation logic

## [0.1.5] - 2025-11-15

### Changed

- Updated package metadata and dependencies

## [0.1.4] - 2025-11-15

### Fixed

- Configuration validation improvements

## [0.1.3] - 2025-11-15

### Added

- Enhanced error handling and logging

## [0.1.2] - 2025-11-15

### Fixed

- Build and deployment fixes

## [0.1.1] - 2025-11-15

### Added

- Initial MCP environment variable support

## [0.1.0] - 2025-11-14

### Added

- Initial release of Athena Protocol MCP Server
- Support for multiple LLM providers (OpenAI, Anthropic, Google, etc.)
- Basic MCP server functionality
- Environment variable configuration system
- Local .env file support
