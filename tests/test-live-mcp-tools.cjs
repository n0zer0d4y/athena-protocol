const { spawn } = require("child_process");
const path = require("path");

async function testLiveMCPTools() {
  console.log("🔴 LIVE MCP TOOLS TEST - Testing LLM Tool Calling");
  console.log("================================================\n");

  console.log("🎯 This test verifies that the MCP server LLM/AI agent can:");
  console.log("   - Call writeFile tool to create files");
  console.log("   - Call replaceInFile tool to modify files");
  console.log("   - Call executeCommand tool to run system commands");
  console.log("   - Use multiple tools in sequence (multi-turn)");
  console.log("   - Perform actual file operations and command execution\n");

  const serverProcess = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });

  let serverReady = false;

  // Listen for server ready signal
  const checkForReady = (data) => {
    const output = data.toString();
    if (output.includes("Athena Protocol - Ready!") && !serverReady) {
      serverReady = true;
      console.log("✅ MCP server is ready!\n");
      runLiveTest();
    }
  };

  serverProcess.stdout.on("data", checkForReady);
  serverProcess.stderr.on("data", checkForReady);

  serverProcess.on("error", (error) => {
    console.error("❌ Server error:", error);
  });

  // Helper function to send MCP requests
  async function sendMCPRequest(request) {
    return new Promise((resolve, reject) => {
      const requestJson = JSON.stringify(request) + "\n";
      serverProcess.stdin.write(requestJson);

      let responseData = "";
      const responseHandler = (data) => {
        const chunk = data.toString();
        responseData += chunk;

        try {
          const response = JSON.parse(responseData.trim());
          if (response.id === request.id) {
            serverProcess.stdout.removeListener("data", responseHandler);
            resolve(response);
          }
        } catch (e) {
          // Continue collecting
        }
      };

      serverProcess.stdout.on("data", responseHandler);

      // Long timeout for complex operations
      setTimeout(() => {
        serverProcess.stdout.removeListener("data", responseHandler);
        console.log("⏰ Response timeout - processing what we have");
        try {
          const response = JSON.parse(responseData.trim());
          resolve(response);
        } catch (e) {
          resolve({
            result: { content: [{ type: "text", text: responseData }] },
          });
        }
      }, 120000); // 2 minutes for complex multi-tool operations
    });
  }

  async function runLiveTest() {
    try {
      // Initialize MCP connection
      await sendMCPRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "live-tools-test",
            version: "1.0.0",
          },
        },
      });

      console.log("✅ MCP initialized\n");

      // LIVE TEST: Create a comprehensive diagnostic system
      console.log("🔴 LIVE TEST: Create Diagnostic System with Multiple Tools");
      console.log("=======================================================");
      console.log(
        "Scenario: MCP server LLM must create a diagnostic script, modify it,"
      );
      console.log(
        "          execute it, and create a report - using multiple tools!\n"
      );

      const liveTestRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "thinking_validation",
          arguments: {
            thinking:
              "I need to create a comprehensive system diagnostic that checks Node.js environment, creates multiple files, modifies them, and executes commands. This will test all enabled tools: writeFile, replaceInFile, executeCommand, and others. The diagnostic should include version checks, file operations, and system information gathering.",
            proposedChange: {
              description:
                "Create a complete system diagnostic suite using all available tools",
              code: "Write diagnostic script, modify it with additional checks, execute it, create report",
              files: [
                "comprehensive-diagnostic.js",
                "system-report.json",
                "diagnostic-config.json",
                "execution-log.txt",
              ],
            },
            context: {
              problem:
                "Need to verify complete tool ecosystem functionality through live multi-tool operations",
              techStack: "nodejs, npm, system commands, file operations",
              constraints: [
                "Must use writeFile to create script",
                "Must use replaceInFile to modify script",
                "Must use executeCommand to run diagnostics",
                "Must use grep to analyze results",
                "Must use listFiles to show created files",
                "Create comprehensive diagnostic report",
              ],
            },
            urgency: "high",
            projectContext: {
              projectRoot: path.resolve(__dirname),
              filesToAnalyze: [
                path.resolve(__dirname, "package.json"),
                path.resolve(__dirname, "ENV_REFERENCE.md"),
              ],
              workingDirectory: path.resolve(__dirname),
            },
            projectBackground:
              "MCP server project requiring comprehensive tool validation through live multi-tool diagnostic system creation and execution",
          },
        },
      };

      console.log("🚀 Sending complex multi-tool request to MCP server...");
      console.log("💭 The LLM/AI agent should now:");
      console.log("   1. Analyze project files (grep first)");
      console.log("   2. Create diagnostic script (writeFile)");
      console.log("   3. Modify script with additional checks (replaceInFile)");
      console.log("   4. Execute the diagnostic (executeCommand)");
      console.log("   5. Create report files (writeFile)");
      console.log("   6. Verify results (grep, readFile)");
      console.log("   7. List all created files (listFiles)");
      console.log("");

      const response = await sendMCPRequest(liveTestRequest);

      console.log("📥 Response received from MCP server\n");

      try {
        const result = JSON.parse(response.result.content[0].text);

        console.log("🔍 ANALYSIS RESULTS:");
        console.log("===================");
        console.log(`📊 Files Analyzed: ${result.metadata.filesAnalyzed}`);
        console.log(`🛠️  Tools Used: ${result.metadata.toolsUsed.join(", ")}`);

        // Check for specific enabled tools
        const usedTools = result.metadata.toolsUsed || [];
        console.log("");
        console.log("🔧 TOOL USAGE VERIFICATION:");
        console.log(
          `   📝 writeFile:        ${
            usedTools.includes("writeFile") ? "✅ USED" : "❌ NOT USED"
          }`
        );
        console.log(
          `   🔄 replaceInFile:    ${
            usedTools.includes("replaceInFile") ? "✅ USED" : "❌ NOT USED"
          }`
        );
        console.log(
          `   ⚡ executeCommand:   ${
            usedTools.includes("executeCommand") ? "✅ USED" : "❌ NOT USED"
          }`
        );
        console.log(
          `   🔍 grep:            ${
            usedTools.includes("grep") ? "✅ USED" : "❌ NOT USED"
          }`
        );
        console.log(
          `   📖 readFile:        ${
            usedTools.includes("readFile") ? "✅ USED" : "❌ NOT USED"
          }`
        );
        console.log(
          `   📋 listFiles:       ${
            usedTools.includes("listFiles") ? "✅ USED" : "❌ NOT USED"
          }`
        );

        console.log("");
        console.log("📋 VALIDATION DETAILS:");
        console.log(
          `   Critical Issues Found: ${result.validation.criticalIssues.length}`
        );
        console.log(
          `   Recommendations: ${result.validation.recommendations.length}`
        );

        if (result.validation.criticalIssues.length > 0) {
          console.log("   💡 Issues identified:");
          result.validation.criticalIssues.slice(0, 3).forEach((issue, i) => {
            console.log(`      ${i + 1}. ${issue.issue.substring(0, 80)}...`);
          });
        }

        console.log("");
        console.log("📁 EXPECTED FILES CREATED:");
        console.log("   - comprehensive-diagnostic.js");
        console.log("   - system-report.json");
        console.log("   - diagnostic-config.json");
        console.log("   - execution-log.txt");
      } catch (e) {
        console.log("⚠️  JSON parsing failed, showing raw response:");
        const rawResponse = response.result.content[0].text;
        console.log("Raw response length:", rawResponse.length);
        console.log("First 1000 chars:");
        console.log(rawResponse.substring(0, 1000));
        if (rawResponse.length > 1000) {
          console.log("...");
        }
      }

      console.log("");
      console.log("🔍 POST-TEST VERIFICATION:");
      console.log("==========================");
      console.log("Check if these files were actually created:");
      console.log("   - comprehensive-diagnostic.js");
      console.log("   - system-report.json");
      console.log("   - diagnostic-config.json");
      console.log("   - execution-log.txt");

      // Check for created files
      const fs = require("fs").promises;
      const filesToCheck = [
        "comprehensive-diagnostic.js",
        "system-report.json",
        "diagnostic-config.json",
        "execution-log.txt",
      ];

      console.log("");
      console.log("📂 FILE CREATION VERIFICATION:");
      for (const file of filesToCheck) {
        try {
          await fs.access(file);
          const stats = await fs.stat(file);
          console.log(`   ✅ ${file} - Created (${stats.size} bytes)`);
        } catch (e) {
          console.log(`   ❌ ${file} - Not found`);
        }
      }
    } catch (error) {
      console.error("❌ Test failed:", error.message);
    } finally {
      console.log("\n🧹 Cleaning up MCP server...");
      serverProcess.kill();
      process.exit(0);
    }
  }

  // Timeout for server startup
  setTimeout(() => {
    if (!serverReady) {
      console.log("⏳ Server startup timeout");
      serverProcess.kill();
      process.exit(1);
    }
  }, 20000);
}

testLiveMCPTools().catch(console.error);
