/**
 * Git Operations Tool - MCP tool for executing git commands
 *
 * Enables version control operations within the MCP server. Supports common git commands
 * like status, commit, branch operations, and repository management. Provides safe execution
 * with proper error handling and result formatting for development workflows.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function gitOperationTool(args: {
  operation: string;
  path: string;
  args?: string[];
}): Promise<{ stdout: string; stderr: string; success: boolean; error?: string }> {
  try {
    const { operation, path, args: additionalArgs = [] } = args;
    
    let command = `git ${operation}`;
    if (additionalArgs.length > 0) {
      command += ` ${additionalArgs.join(' ')}`;
    }
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: path,
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