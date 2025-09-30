/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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