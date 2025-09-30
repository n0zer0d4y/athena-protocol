/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export async function grepTool(args: {
  pattern: string;
  path: string;
  recursive?: boolean;
  caseSensitive?: boolean;
}): Promise<{ matches: Array<{ file: string; line: number; content: string }>; success: boolean; error?: string }> {
  try {
    const { pattern, path, recursive = false, caseSensitive = false } = args;
    const matches: Array<{ file: string; line: number; content: string }> = [];
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    
    const searchFile = async (filePath: string): Promise<void> => {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            matches.push({
              file: filePath,
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      } catch (error) {
        // Skip files we can't read
      }
    };
    
    const searchDirectory = async (dirPath: string): Promise<void> => {
      try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = join(dirPath, item.name);
          
          if (item.isDirectory()) {
            if (recursive) {
              await searchDirectory(itemPath);
            }
          } else {
            await searchFile(itemPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    const stats = await fs.stat(path);
    if (stats.isDirectory()) {
      await searchDirectory(path);
    } else {
      await searchFile(path);
    }
    
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