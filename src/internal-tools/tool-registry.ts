/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileTool } from './read-file.js';
import { writeFileTool } from './write-file.js';
import { listFilesTool } from './list-files.js';
import { readManyFilesTool } from './read-many-files.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { executeShellTool } from './execute-shell.js';
import { gitOperationTool } from './git-operation.js';
import { webSearchTool } from './web-search.js';

export interface ToolRegistry {
  readFile: (args: any) => Promise<any>;
  writeFile: (args: any) => Promise<any>;
  listFiles: (args: any) => Promise<any>;
  readManyFiles: (args: any) => Promise<any>;
  glob: (args: any) => Promise<any>;
  grep: (args: any) => Promise<any>;
  executeShell: (args: any) => Promise<any>;
  gitOperation: (args: any) => Promise<any>;
  webSearch: (args: any) => Promise<any>;
}

export function createToolRegistry(): ToolRegistry {
  return {
    readFile: readFileTool,
    writeFile: writeFileTool,
    listFiles: listFilesTool,
    readManyFiles: readManyFilesTool,
    glob: globTool,
    grep: grepTool,
    executeShell: executeShellTool,
    gitOperation: gitOperationTool,
    webSearch: webSearchTool,
  };
}