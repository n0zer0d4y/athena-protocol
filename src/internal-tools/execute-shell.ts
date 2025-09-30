/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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