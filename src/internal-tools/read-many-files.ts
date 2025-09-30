/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';

export async function readManyFilesTool(args: {
  paths: string[];
  encoding?: string;
}): Promise<{ results: Array<{ path: string; content?: string; error?: string }>; success: boolean }> {
  try {
    const { paths, encoding = 'utf8' } = args;
    const results = [];
    
    for (const path of paths) {
      try {
        const content = await fs.readFile(path, { encoding: encoding as BufferEncoding });
        results.push({
          path,
          content,
        });
      } catch (error) {
        results.push({
          path,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return {
      results,
      success: true,
    };
  } catch (error) {
    return {
      results: [],
      success: false,
    };
  }
}