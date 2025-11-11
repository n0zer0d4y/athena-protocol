/**
 * Tool Executor - Core execution engine for MCP tools
 *
 * This module provides the primary execution framework for all MCP tools within the Athena Protocol.
 * It handles tool registration, parameter validation, execution coordination, and result processing
 * for file system operations, shell commands, and development workflows.
 */

import { readFileTool, readMultipleFilesTool } from '../internal-tools/unified-read-files.js';
import { writeFileTool } from '../internal-tools/write-file.js';
import { listFilesTool } from '../internal-tools/list-files.js';
import { globTool } from '../internal-tools/glob.js';
import { grepTool } from '../internal-tools/grep.js';
import { executeShellTool } from '../internal-tools/execute-shell.js';
import { gitOperationTool } from '../internal-tools/git-operation.js';
import { logger } from '../utils/logger.js';

export interface ToolExecutionResult {
  result: any;
  success: boolean;
  error?: string;
}

export class ToolExecutor {
  private tools: Map<string, (args: any) => Promise<any>>;

  constructor() {
    this.tools = new Map();
    
    // Add each tool individually to avoid type issues
    this.tools.set('readFile', readFileTool);
    this.tools.set('writeFile', writeFileTool);
    this.tools.set('listFiles', listFilesTool);
    this.tools.set('readManyFiles', readMultipleFilesTool);
    this.tools.set('glob', globTool);
    this.tools.set('grep', grepTool);
    this.tools.set('executeShell', executeShellTool);
    this.tools.set('gitOperation', gitOperationTool);
  }

  async executeTool(toolName: string, args: any): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      const error = `Unknown tool: ${toolName}`;
      logger.error(error);
      return {
        result: null,
        success: false,
        error,
      };
    }

    try {
      logger.info(`Executing tool: ${toolName} with args:`, args);
      const result = await tool(args);
      
      // Check if the tool returned a success indicator
      if (typeof result === 'object' && 'success' in result) {
        if (!result.success) {
          logger.warn(`Tool ${toolName} execution failed:`, result.error);
          return {
            result,
            success: false,
            error: result.error,
          };
        }
      }

      logger.info(`Tool ${toolName} executed successfully`);
      return {
        result,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error executing tool ${toolName}:`, errorMessage);
      return {
        result: null,
        success: false,
        error: errorMessage,
      };
    }
  }

  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }
}