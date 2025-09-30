#!/usr/bin/env node

import { config } from "dotenv";
import { ThinkingValidator } from "../dist/core/thinking-validator.js";
import { createToolRegistry } from "../dist/internal-tools/tool-registry.js";
import { ToolCallingService } from "../dist/services/tool-calling-service.js";
import { getBestAvailableProvider } from "../dist/config-manager.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

async function testThinkingValidatorDirectly() {
  console.log("🧠 Testing Thinking Validator Directly");
  console.log("=====================================\n");

  try {
    // Initialize components
    console.log("🔧 Initializing components...");
    const toolRegistry = createToolRegistry();
    const toolCallingService = new ToolCallingService({
      readFile: { enabled: true },
      searchFiles: { enabled: true },
      listFiles: { enabled: true },
      writeToFile: { enabled: false },
      replaceInFile: { enabled: false },
      executeCommand: { enabled: false },
    });

    const provider = getBestAvailableProvider();
    console.log(`📡 Using provider: ${provider}`);

    const thinkingValidator = new ThinkingValidator();
    thinkingValidator.setToolCallingService(toolCallingService);
    console.log("✅ ThinkingValidator created");
    console.log(
      "🔧 Tool calling service available:",
      !!thinkingValidator.toolCallingService
    );

    // Initialize the thinking validator
    await thinkingValidator.initialize({
      // Add any required config here
    });
    console.log("✅ Components initialized\n");

    // Test thinking validation
    console.log("🧪 Running thinking validation test...");

    const testRequest = {
      thinking:
        "I need to add user authentication to the existing Node.js Express app. I should create a middleware function that validates JWT tokens and protects routes.",
      proposedChange: {
        description: "Add JWT authentication middleware to protect API routes",
        code: "Add auth middleware, update routes to use authentication",
        files: ["src/middleware/auth.js", "src/routes/user.js"],
      },
      context: {
        problem:
          "API endpoints are not protected and anyone can access user data",
        techStack: "nodejs, express, mongodb",
        constraints: ["Must maintain backward compatibility", "Use JWT tokens"],
      },
      urgency: "high",
      projectContext: {
        projectRoot: path.resolve(__dirname, "../test-project"),
        filesToAnalyze: ["package.json", "src/server.js"],
        workingDirectory: path.resolve(__dirname, "../test-project"),
      },
      projectBackground:
        "Node.js Express API server with MongoDB database for user management system",
    };

    console.log("📤 Sending request to thinking validator...");
    console.log("Request:", JSON.stringify(testRequest, null, 2));

    const result = await thinkingValidator.validateThinking(testRequest);

    console.log("\n📥 Received response:");
    console.log("=====================================");
    console.log(JSON.stringify(result, null, 2));
    console.log("=====================================\n");

    if (result.validation && result.validation.goAhead) {
      console.log("✅ Thinking validation completed successfully!");
      console.log(`📊 Confidence: ${result.validation.confidence}%`);
      console.log(
        `🎯 Critical issues found: ${
          result.validation.criticalIssues?.length || 0
        }`
      );
      console.log(
        `💡 Recommendations: ${result.validation.recommendations?.length || 0}`
      );
      console.log(
        `🧪 Test cases suggested: ${result.validation.testCases?.length || 0}`
      );
    } else {
      console.log("❌ Thinking validation failed");
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test
testThinkingValidatorDirectly().catch(console.error);
