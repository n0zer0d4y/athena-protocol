#!/usr/bin/env node

// Standalone server for testing the Athena Protocol
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import express from "express";
import { loadConfig } from "./config-manager.js";
import { ThinkingValidator } from "./core/thinking-validator.js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

dotenv.config({ path: join(projectRoot, ".env") });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize the thinking validator
const config = loadConfig();
const thinkingValidator = new ThinkingValidator();
await thinkingValidator.initialize(config);

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    // Basic health check - thinking validator is initialized
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Athena Protocol standalone server is running",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: (error as Error).message,
    });
  }
});

// List providers endpoint
app.get("/providers", async (req, res) => {
  try {
    // Return basic provider information from config
    const { getConfiguredProviders } = await import("./config-manager.js");
    const providers = getConfiguredProviders();
    res.json({
      status: "ok",
      providers: providers.map((p) => ({ name: p.name, enabled: p.hasApiKey })),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: (error as Error).message,
    });
  }
});

// Thinking validation endpoint
app.post("/validate", async (req, res) => {
  try {
    const result = await thinkingValidator.validateThinking(
      req.body,
      req.body.sessionId,
      req.body.provider
    );
    res.json({
      status: "ok",
      result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: (error as Error).message,
    });
  }
});

// Impact analysis endpoint
app.post("/impact", async (req, res) => {
  try {
    const result = await thinkingValidator.analyzeImpact(
      req.body,
      req.body.sessionId,
      req.body.provider
    );
    res.json({
      status: "ok",
      result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: (error as Error).message,
    });
  }
});

// Assumption checking endpoint
app.post("/assumptions", async (req, res) => {
  try {
    const result = await thinkingValidator.checkAssumptions(
      req.body,
      req.body.sessionId,
      req.body.provider
    );
    res.json({
      status: "ok",
      result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: (error as Error).message,
    });
  }
});

// Dependency mapping endpoint
app.post("/dependencies", async (req, res) => {
  try {
    const result = await thinkingValidator.mapDependencies(
      req.body,
      req.body.sessionId,
      req.body.provider
    );
    res.json({
      status: "ok",
      result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: (error as Error).message,
    });
  }
});

// Thinking optimization endpoint
app.post("/optimize", async (req, res) => {
  try {
    const result = await thinkingValidator.optimizeThinking(
      req.body,
      req.body.sessionId,
      req.body.provider
    );
    res.json({
      status: "ok",
      result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: (error as Error).message,
    });
  }
});

// Session management endpoint
app.get("/sessions", async (req, res) => {
  try {
    const sessions = await thinkingValidator.listSessions();
    res.json({
      status: "ok",
      sessions,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: (error as Error).message,
    });
  }
});

app.listen(port, () => {
  console.log(
    `Athena Protocol standalone server running at http://localhost:${port}`
  );
  console.log("Available endpoints:");
  console.log("  GET  /health      - Check provider health");
  console.log("  GET  /providers   - List available providers");
  console.log("  POST /validate    - Validate thinking");
  console.log("  POST /impact      - Analyze impact");
  console.log("  POST /assumptions - Check assumptions");
  console.log("  POST /dependencies - Map dependencies");
  console.log("  POST /optimize    - Optimize thinking");
  console.log("  GET  /sessions    - List sessions");
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down Athena Protocol...");
  process.exit(0);
});
