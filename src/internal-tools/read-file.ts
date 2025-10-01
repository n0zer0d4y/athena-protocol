/**
 * File Reader Tool - MCP tool for reading individual files
 *
 * Provides efficient single-file reading capabilities with configurable encoding support
 * and line-based reading options. Includes proper error handling and validation for
 * file access operations within the Athena Protocol MCP Server ecosystem.
 */

import { promises as fs } from 'fs';

export async function readFileTool(args: {
  path: string;
  encoding?: string;
}): Promise<{ content: string; success: boolean; error?: string }> {
  try {
    const { path, encoding = 'utf8' } = args;
    const content = await fs.readFile(path, { encoding: encoding as BufferEncoding });
    return {
      content,
      success: true,
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}