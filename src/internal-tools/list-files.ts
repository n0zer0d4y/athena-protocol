/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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