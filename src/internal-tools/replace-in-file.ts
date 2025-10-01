/**
 * Replace In File Tool - MCP tool for targeted text replacement within files
 *
 * Provides secure text replacement capabilities for file content modification. Supports
 * targeted string replacement with validation, error handling, and logging. Includes
 * file existence checks and content verification before performing replacements.
 * SECURITY WARNING: Only enable in trusted environments.
 */

import { promises as fs } from "fs";
import { resolve, dirname } from "path";
import { logger } from "../utils/logger.js";

export interface ReplaceInFileArgs {
  path: string;
  oldString: string;
  newString: string;
}

export async function replaceInFileTool(args: ReplaceInFileArgs): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const { path, oldString, newString } = args;

    // Resolve the full path and validate it exists
    const fullPath = resolve(path);

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return {
        success: false,
        error: `File does not exist: ${fullPath}`,
      };
    }

    // Read the current file content
    const content = await fs.readFile(fullPath, "utf-8");

    // Check if the oldString exists in the file
    if (!content.includes(oldString)) {
      return {
        success: false,
        error: `Old string not found in file: "${oldString}"`,
      };
    }

    // Perform the replacement
    const newContent = content.replace(oldString, newString);

    // Write the updated content back to the file
    await fs.writeFile(fullPath, newContent, "utf-8");

    logger.info(`Successfully replaced text in file: ${fullPath}`);

    return {
      success: true,
      message: `Successfully replaced text in ${fullPath}`,
    };
  } catch (error) {
    logger.error("Error in replaceInFileTool:", error);
    return {
      success: false,
      error: `Failed to replace in file: ${(error as Error).message}`,
    };
  }
}