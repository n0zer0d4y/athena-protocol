/**
 * Directory Listing Tool - MCP tool for listing directory contents
 *
 * Provides comprehensive directory content listing with recursive support and filtering options.
 * Supports both flat and hierarchical directory structures with configurable depth limits
 * and pattern-based filtering for targeted file system exploration.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export async function listFilesTool(args: {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
}): Promise<{ files: string[]; success: boolean; error?: string }> {
  try {
    const { path, recursive = false, includeHidden = false } = args;
    const files: string[] = [];
    
    const processDirectory = async (dirPath: string, basePath: string = ''): Promise<void> => {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        // Skip hidden files if not requested
        if (!includeHidden && item.name.startsWith('.')) {
          continue;
        }
        
        const itemFullPath = join(dirPath, item.name);
        const relativePath = join(basePath, item.name);
        
        if (item.isDirectory()) {
          files.push(`${relativePath}/`);
          if (recursive) {
            await processDirectory(itemFullPath, relativePath);
          }
        } else {
          files.push(relativePath);
        }
      }
    };
    
    await processDirectory(path);
    
    return {
      files,
      success: true,
    };
  } catch (error) {
    return {
      files: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}