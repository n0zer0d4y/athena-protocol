/**
 * Unified Read Files Tool - Enhanced file reading with mode support
 *
 * Supports multiple read modes for text files:
 * - full: Read entire file
 * - head: Read first N lines
 * - tail: Read last N lines
 * - range: Read lines from X to Y
 *
 * Handles both single and multiple files concurrently
 */

import { promises as fs } from "fs";
import {
  ReadFileArgs,
  ReadFileRequest,
  ReadMultipleFilesArgs,
  ReadFileResult,
  ReadMultipleFilesResult,
  ReadFileArgsSchema,
  ReadMultipleFilesArgsSchema,
} from "../types/internal-tool-types.js";

/**
 * Read first N lines from a file
 */
async function headFile(filePath: string, numLines: number): Promise<string> {
  const fileHandle = await fs.open(filePath, "r");
  try {
    const lines: string[] = [];
    let buffer = "";
    let bytesRead = 0;
    const chunk = Buffer.alloc(1024); // 1KB buffer

    // Read chunks and count lines until we have enough or reach EOF
    while (lines.length < numLines) {
      const result = await fileHandle.read(chunk, 0, chunk.length, bytesRead);
      if (result.bytesRead === 0) break; // End of file
      bytesRead += result.bytesRead;
      buffer += chunk.slice(0, result.bytesRead).toString("utf-8");

      const newLineIndex = buffer.lastIndexOf("\n");
      if (newLineIndex !== -1) {
        const completeLines = buffer.slice(0, newLineIndex).split("\n");
        lines.push(...completeLines);
        buffer = buffer.slice(newLineIndex + 1);

        // If we have enough lines, break early
        if (lines.length >= numLines) {
          break;
        }
      }
    }

    // Handle any remaining buffer content
    if (buffer.length > 0 && lines.length < numLines) {
      lines.push(buffer);
    }

    // Return only the requested number of lines
    return lines.slice(0, numLines).join("\n");
  } finally {
    await fileHandle.close();
  }
}

/**
 * Read last N lines from a file
 */
async function tailFile(filePath: string, numLines: number): Promise<string> {
  const CHUNK_SIZE = 1024; // Read 1KB at a time
  const stats = await fs.stat(filePath);
  const fileSize = stats.size;

  if (fileSize === 0) return "";

  // Open file for reading
  const fileHandle = await fs.open(filePath, "r");
  try {
    const lines: string[] = [];
    let position = fileSize;
    let chunk = Buffer.alloc(CHUNK_SIZE);
    let linesFound = 0;
    let remainingText = "";

    // Read chunks from the end of the file until we have enough lines
    while (position > 0 && linesFound < numLines) {
      const chunkSize = Math.min(CHUNK_SIZE, position);
      position -= chunkSize;

      const result = await fileHandle.read(
        chunk,
        0,
        chunkSize,
        position
      );
      const text = chunk.slice(0, result.bytesRead).toString("utf-8");
      const combined = text + remainingText;

      const parts = combined.split("\n");
      remainingText = parts[0]; // Save first part for next iteration

      // Add lines in reverse order (since we're reading backwards)
      for (let i = parts.length - 1; i >= 1; i--) {
        lines.unshift(parts[i]);
        linesFound++;
        if (linesFound >= numLines) break;
      }
    }

    // Add remaining text if it exists and we need it
    if (linesFound < numLines && remainingText.length > 0) {
      lines.unshift(remainingText);
    }

    return lines.slice(-numLines).join("\n");
  } finally {
    await fileHandle.close();
  }
}

/**
 * Read a range of lines from a file (1-indexed, inclusive)
 */
async function rangeFile(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<string> {
  const CHUNK_SIZE = 1024; // Read 1KB at a time
  const fileHandle = await fs.open(filePath, "r");

  try {
    const targetLines: string[] = [];
    let currentLineNumber = 0;
    let buffer = "";
    let bytesRead = 0;
    const chunk = Buffer.alloc(CHUNK_SIZE);

    // Read file sequentially until we reach the end line
    while (currentLineNumber < endLine) {
      const result = await fileHandle.read(chunk, 0, chunk.length, bytesRead);

      // End of file reached
      if (result.bytesRead === 0) {
        // Handle last line if buffer has content
        if (buffer.length > 0) {
          currentLineNumber++;
          if (currentLineNumber >= startLine && currentLineNumber <= endLine) {
            targetLines.push(buffer);
          }
        }
        break;
      }

      bytesRead += result.bytesRead;
      buffer += chunk.slice(0, result.bytesRead).toString("utf-8");

      // Process complete lines
      const newLineIndex = buffer.lastIndexOf("\n");
      if (newLineIndex !== -1) {
        const lines = buffer.slice(0, newLineIndex).split("\n");
        buffer = buffer.slice(newLineIndex + 1);

        for (const line of lines) {
          currentLineNumber++;
          if (currentLineNumber >= startLine && currentLineNumber <= endLine) {
            targetLines.push(line);
          }
          // Early exit if we've collected all needed lines
          if (currentLineNumber >= endLine) {
            break;
          }
        }
      }
    }

    return targetLines.join("\n");
  } finally {
    await fileHandle.close();
  }
}

/**
 * Read a single file with mode support
 */
async function readSingleFile(args: ReadFileArgs): Promise<ReadFileResult> {
  try {
    // Validate args with Zod schema
    const validated = ReadFileArgsSchema.parse(args);
    const { path, mode = "full", lines, startLine, endLine } = validated;

    let content: string;

    switch (mode) {
      case "head":
        if (!lines) {
          throw new Error("'lines' parameter required for head mode");
        }
        content = await headFile(path, lines);
        break;

      case "tail":
        if (!lines) {
          throw new Error("'lines' parameter required for tail mode");
        }
        content = await tailFile(path, lines);
        break;

      case "range":
        if (!startLine || !endLine) {
          throw new Error(
            "'startLine' and 'endLine' parameters required for range mode"
          );
        }
        content = await rangeFile(path, startLine, endLine);
        break;

      case "full":
      default:
        // Read entire file
        content = await fs.readFile(path, "utf-8");
        break;
    }

    return {
      success: true,
      content,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Read multiple files concurrently with per-file mode support
 */
export async function readMultipleFilesTool(
  args: ReadMultipleFilesArgs
): Promise<ReadMultipleFilesResult> {
  try {
    // DEBUG: Log what we received
    console.error("[readMultipleFilesTool] Received args:", JSON.stringify(args, null, 2));
    console.error("[readMultipleFilesTool] Files count:", args.files?.length || 0);
    
    // Validate args with Zod schema
    const validated = ReadMultipleFilesArgsSchema.parse(args);
    const { files } = validated;

    console.error("[readMultipleFilesTool] Validated files count:", files.length);

    // Read all files concurrently using Promise.all
    const results = await Promise.all(
      files.map(async (fileRequest) => {
        console.error("[readMultipleFilesTool] Reading file:", fileRequest.path, "mode:", fileRequest.mode, "lines:", fileRequest.lines);
        const result = await readSingleFile(fileRequest);
        console.error("[readMultipleFilesTool] Read result for", fileRequest.path, "success:", result.success, "content length:", result.content?.length || 0);
        return {
          path: fileRequest.path,
          content: result.content,
          error: result.error,
        };
      })
    );

    console.error("[readMultipleFilesTool] Total results:", results.length);

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("[readMultipleFilesTool] ERROR:", error);
    return {
      success: false,
      results: [],
    };
  }
}

/**
 * Convenience function for reading a single file
 * Wraps readMultipleFilesTool for backward compatibility
 */
export async function readFileTool(args: ReadFileArgs): Promise<ReadFileResult> {
  return readSingleFile(args);
}

