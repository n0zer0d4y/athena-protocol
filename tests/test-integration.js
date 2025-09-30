#!/usr/bin/env node

import { ToolCallingService } from "../dist/services/tool-calling-service.js";
import { loadToolCallingConfig } from "../dist/config-manager.js";

async function testIntegration() {
  console.log(
    "🧪 Testing tool-calling service integration with internal tools..."
  );

  try {
    // Load configuration
    const config = loadToolCallingConfig();
    console.log("✅ Configuration loaded:", config);

    // Create tool calling service
    const toolService = new ToolCallingService(config);
    console.log("✅ Tool calling service created");

    // Test reading a file
    console.log("📖 Testing file read...");
    const readResult = await toolService.readFile("./package.json");
    if (readResult.success) {
      console.log(
        "✅ File read successful, content length:",
        readResult.content?.length || 0
      );
    } else {
      console.log("❌ File read failed:", readResult.error);
    }

    // Test listing files
    console.log("📂 Testing directory listing...");
    const listResult = await toolService.listFiles(".", false);
    if (listResult.success) {
      console.log(
        "✅ Directory listing successful, found",
        listResult.files?.length || 0,
        "files"
      );
    } else {
      console.log("❌ Directory listing failed:", listResult.error);
    }

    console.log("🎉 Integration test completed!");
  } catch (error) {
    console.error("❌ Integration test failed:", error);
    process.exit(1);
  }
}

testIntegration();
