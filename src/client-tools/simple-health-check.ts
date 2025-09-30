import { getConfiguredProviders, getApiKey } from "../config-manager.js";

/**
 * Simple health check tool that shows system status and active provider information
 * Displays only the default provider from .env and all ACTIVE providers
 */
export const HEALTH_CHECK_TOOL = {
  name: "athena_health_check",
  description: `Get system health status and active provider information.

This tool provides:
- Current default LLM provider from .env configuration
- List of all ACTIVE providers (with valid API keys and models)
- Simple overview of system health

Use this tool to:
- Check which providers are currently active and configured
- Verify your default provider setting
- Get a quick overview of available LLM providers
- Confirm system readiness for LLM operations`,
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async (args: any) => {
    try {
      // Get default provider from environment
      const defaultProvider = process.env.DEFAULT_LLM_PROVIDER?.trim();

      // Get all configured providers
      const configuredProviders = getConfiguredProviders();

      // Filter to ACTIVE providers only (those with valid API keys and models)
      // Exclude obvious placeholder/dummy API keys
      const activeProviders = configuredProviders.filter((p) => {
        if (!p.hasApiKey || !p.model) return false;

        // Get the actual API key to check if it's a placeholder
        const apiKey = getApiKey(p.name);
        if (!apiKey) return false;

        // Check for common placeholder patterns
        const placeholderPatterns = [
          /^sk-ant-your-/,
          /^your-.*-key-here$/,
          /^your-.*-here$/,
          /^placeholder/i,
          /^dummy/i,
          /^test.*key/i,
          /^example/i,
        ];

        // If API key matches any placeholder pattern, consider it inactive
        for (const pattern of placeholderPatterns) {
          if (pattern.test(apiKey)) {
            return false;
          }
        }

        return true;
      });

      // Build the health check result
      let result = "## 🔍 **Athena Protocol Health Check**\n\n";

      // Default provider section
      result += "### 🎯 **Default Provider**\n\n";
      if (defaultProvider) {
        const isActive = activeProviders.some(
          (p) => p.name === defaultProvider
        );
        const status = isActive ? "✅ ACTIVE" : "❌ INACTIVE";
        result += `**${defaultProvider}** - ${status}\n\n`;

        if (!isActive) {
          result +=
            "⚠️ **Warning:** Default provider is not properly configured!\n\n";
        }
      } else {
        result += "❌ **No default provider configured**\n\n";
        result += "Set `DEFAULT_LLM_PROVIDER` in your .env file\n\n";
      }

      // Active providers section (ONLY active providers shown)
      result += "### ✅ **Active Providers**\n\n";
      if (activeProviders.length > 0) {
        for (const provider of activeProviders) {
          const isDefault = provider.name === defaultProvider;
          const defaultMarker = isDefault ? " (default)" : "";
          result += `**${provider.name}${defaultMarker}**\n`;
          result += `  • API Key: ✅ Configured\n`;
          result += `  • Model: ${provider.model}\n`;
          result += `  • Override Capable: ✅ Valid API key configured\n\n`;
        }
      } else {
        result += "❌ **No active providers found**\n\n";
        result += "Configure at least one provider with API key and model\n\n";
      }

      // System status summary
      result += "### 📊 **System Status**\n\n";
      result += `**Active Providers:** ${activeProviders.length}\n`;
      result += `**System Ready:** ${
        activeProviders.length > 0 ? "✅ YES" : "❌ NO"
      }\n\n`;

      // Recommendations
      result += "### 💡 **Recommendations**\n\n";
      if (activeProviders.length === 0) {
        result +=
          "• **Configure at least one provider** with API key and model\n";
        result += "• Check your .env file for proper configuration\n";
        result +=
          "• Run `validate_configuration_comprehensive` for detailed setup guidance\n";
      } else if (
        !defaultProvider ||
        !activeProviders.some((p) => p.name === defaultProvider)
      ) {
        result += "• **Set a valid default provider** in your .env file\n";
        result +=
          "• Choose from your active providers: " +
          activeProviders.map((p) => p.name).join(", ") +
          "\n";
      } else {
        result +=
          "• **System is ready!** All providers are properly configured\n";
        result += "• Use other Athena Protocol tools for thinking validation\n";
      }

      return result;
    } catch (error) {
      return `## ❌ **Health Check Error**\n\n**Error:** ${
        error instanceof Error ? error.message : String(error)
      }\n\nPlease check your .env configuration and try again.`;
    }
  },
};
