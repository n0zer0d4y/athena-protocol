/**
 * Tool Registry - Central registry for all MCP server tools
 *
 * This module provides a centralized registry that manages and exports all available
 * MCP tools including file operations, shell commands, search capabilities, and git operations.
 * It serves as the main entry point for tool discovery and registration within the Athena Protocol MCP Server.
 */

// Enhanced tools
import { readFileTool, readMultipleFilesTool } from "./unified-read-files.js";
import { editFileTool } from "./edit-file.js";

// Legacy tools (keeping for backward compatibility)
import { writeFileTool } from "./write-file.js";
import { listFilesTool } from "./list-files.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { executeShellTool } from "./execute-shell.js";
import { gitOperationTool } from "./git-operation.js";
import { webSearchTool } from "./web-search.js";

export interface ToolRegistry {
  // Enhanced tools
  readFile: (args: any) => Promise<any>;
  readMultipleFiles: (args: any) => Promise<any>;
  editFile: (args: any) => Promise<any>;
  
  // Legacy tools
  writeFile: (args: any) => Promise<any>;
  listFiles: (args: any) => Promise<any>;
  glob: (args: any) => Promise<any>;
  grep: (args: any) => Promise<any>;
  executeShell: (args: any) => Promise<any>;
  gitOperation: (args: any) => Promise<any>;
  webSearch: (args: any) => Promise<any>;
}

export function createToolRegistry(): ToolRegistry {
  return {
    // Enhanced tools
    readFile: readFileTool,
    readMultipleFiles: readMultipleFilesTool,
    editFile: editFileTool,
    
    // Legacy tools
    writeFile: writeFileTool,
    listFiles: listFilesTool,
    glob: globTool,
    grep: grepTool,
    executeShell: executeShellTool,
    gitOperation: gitOperationTool,
    webSearch: webSearchTool,
  };
}
