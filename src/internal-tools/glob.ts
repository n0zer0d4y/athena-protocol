/**
 * File Pattern Tool - MCP tool for file globbing operations
 *
 * Provides advanced file pattern matching and discovery capabilities. Supports glob patterns
 * for recursive directory traversal, file filtering, and batch file operations. Essential for
 * project-wide file analysis and automated file processing workflows.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';

export async function globTool(args: {
  pattern: string;
  root?: string;
}): Promise<{ matches: string[]; success: boolean; error?: string }> {
  try {
    const { pattern, root = process.cwd() } = args;
    const matches: string[] = [];
    
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\./g, '\\.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    const searchDirectory = async (dirPath: string, basePath: string = ''): Promise<void> => {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          const itemFullPath = join(dirPath, item.name);
          const relativePath = join(basePath, item.name);
          
          if (item.isDirectory()) {
            if (regex.test(`${relativePath}/`)) {
              matches.push(`${relativePath}/`);
            }
            await searchDirectory(itemFullPath, relativePath);
          } else {
            if (regex.test(relativePath)) {
              matches.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    await searchDirectory(root);
    
    return {
      matches,
      success: true,
    };
  } catch (error) {
    return {
      matches: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}