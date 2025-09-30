#!/usr/bin/env node

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testThinkingValidation() {
  console.log("🧪 Testing MCP Server - Thinking Validation Tool");
  console.log("================================================\n");

  // Start MCP server
  console.log("🚀 Starting MCP server...");
  const serverProcess = spawn("node", ["dist/index.js"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: path.resolve(__dirname, ".."),
  });

  let serverReady = false;
  let serverOutput = "";

  // Listen for server ready signal
  serverProcess.stdout.on("data", (data) => {
    const output = data.toString();
    serverOutput += output;
    console.log("📡 Server output:", output.trim());

    if (output.includes("Athena Protocol - Ready!") && !serverReady) {
      serverReady = true;
      console.log("✅ MCP server is ready!\n");
      runThinkingValidationTest();
    }
  });

  serverProcess.stderr.on("data", (data) => {
    console.log("⚠️  Server stderr:", data.toString().trim());
  });

  serverProcess.on("error", (error) => {
    console.error("❌ Server process error:", error);
  });

  serverProcess.on("exit", (code) => {
    console.log(`🔄 Server process exited with code ${code}`);
  });

  // Wait a bit for server to start
  setTimeout(() => {
    if (!serverReady) {
      console.log("⏳ Server taking longer to start...");
    }
  }, 5000);

  async function runThinkingValidationTest() {
    console.log("🧠 Testing thinking_validation tool...");

    // Create MCP client test
    const testRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "thinking_validation",
        arguments: {
          thinking:
            "I need to add user authentication to the existing Node.js Express app. I should create a middleware function that validates JWT tokens and protects routes.",
          proposedChange: {
            description:
              "Add JWT authentication middleware to protect API routes",
            code: "Add auth middleware, update routes to use authentication",
            files: ["src/middleware/auth.js", "src/routes/user.js"],
          },
          context: {
            problem:
              "API endpoints are not protected and anyone can access user data",
            techStack: "nodejs, express, mongodb",
            constraints: [
              "Must maintain backward compatibility",
              "Use JWT tokens",
            ],
          },
          urgency: "high",
          projectContext: {
            projectRoot: path.join(__dirname, "../test-project"),
            filesToAnalyze: ["package.json", "src/server.js"],
            workingDirectory: path.join(__dirname, "../test-project"),
          },
          projectBackground:
            "Node.js Express API server with MongoDB database for user management system",
        },
      },
    };

    // Send test request to server
    const requestJson = JSON.stringify(testRequest) + "\n";

    console.log("📤 Sending thinking validation request...");
    console.log("Request:", JSON.stringify(testRequest, null, 2));

    serverProcess.stdin.write(requestJson);

    // Listen for response
    let responseData = "";
    const responseTimeout = setTimeout(() => {
      console.log("⏰ Response timeout - collecting what we have...");
      console.log("Raw response data:", responseData);
      cleanup();
    }, 30000);

    function cleanup() {
      clearTimeout(responseTimeout);
      console.log("\n🧹 Cleaning up...");
      serverProcess.kill();
      process.exit(0);
    }

    // Collect response
    serverProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      responseData += chunk;

      // Try to parse complete JSON response
      try {
        const lines = responseData.trim().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            const response = JSON.parse(line.trim());
            console.log("\n📥 Received response:");
            console.log(JSON.stringify(response, null, 2));

            if (response.result && response.result.content) {
              console.log("\n🎯 Thinking validation result:");
              const result = JSON.parse(response.result.content[0].text);
              console.log(JSON.stringify(result, null, 2));
            }

            cleanup();
            return;
          }
        }
      } catch (e) {
        // Response not complete yet, continue collecting
      }
    });
  }

  // Handle Ctrl+C to cleanup
  process.on("SIGINT", () => {
    console.log("\n⚡ Received SIGINT, cleaning up...");
    serverProcess.kill();
    process.exit(0);
  });
}

testThinkingValidation();
