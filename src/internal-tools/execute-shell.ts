/**
 * Shell Execution Tool - MCP tool for running shell commands
 *
 * Provides secure shell command execution capabilities within the MCP server environment.
 * Supports both simple command execution and complex shell operations with proper
 * working directory management, timeout controls, and output capture.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function executeShellTool(args: {
  command: string;
  cwd?: string;
  timeout?: number;
}): Promise<{ stdout: string; stderr: string; success: boolean; error?: string }> {
  try {
    const { command, cwd, timeout = 30000 } = args;
    
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      encoding: 'utf8',
    });
    
    return {
      stdout,
      stderr,
      success: true,
    };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      success: false,
      error: error.message,
    };
  }
}