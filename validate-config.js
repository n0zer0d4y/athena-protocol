#!/usr/bin/env node

/**
 * Configuration Validation Script
 * Tests the current configuration setup for Athena Protocol
 */

import { validateConfigurationComprehensive, formatValidationResults } from './dist/config-manager.js';

async function main() {
  console.log('🔍 Athena Protocol Configuration Validator');
  console.log('==========================================\n');

  try {
    console.log('Loading configuration...\n');

    // Run comprehensive validation
    const result = validateConfigurationComprehensive();

    // Display results
    console.log(formatValidationResults(result));

    // Exit with appropriate code
    if (result.isValid) {
      console.log('✅ Configuration validation PASSED');
      process.exit(0);
    } else {
      console.log('❌ Configuration validation FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Fatal error during configuration validation:');
    console.error(error.message);
    console.error('\nFor help with configuration, see:');
    console.error('- README.md for setup instructions');
    console.error('- docs/mcp-configuration-examples.md for MCP client examples');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
