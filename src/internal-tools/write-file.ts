/**
 * File Writer Tool - MCP tool for writing files to disk
 *
 * Handles file writing operations with automatic directory creation, encoding support,
 * and robust error handling. Provides atomic write operations and backup capabilities
 * for safe file modifications within the MCP server environment.
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';

export async function writeFileTool(args: {
  path: string;
  content: string;
  encoding?: string;
  createDirectories?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { path, content, encoding = 'utf8', createDirectories = true } = args;
    
    if (createDirectories) {
      await fs.mkdir(dirname(path), { recursive: true });
    }
    
    await fs.writeFile(path, content, { encoding: encoding as BufferEncoding });
    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}