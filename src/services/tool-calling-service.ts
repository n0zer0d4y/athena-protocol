import { join, resolve } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import {
  createToolRegistry,
  ToolRegistry,
} from "../internal-tools/tool-registry.js";
import {
  ReadFileArgs,
  ReadFileRequest,
  EditFileArgs,
} from "../types/internal-tool-types.js";

const execAsync = promisify(exec);

export interface ToolCallingConfig {
  readFile: { enabled: boolean };
  grep: { enabled: boolean };
  listFiles: { enabled: boolean };
  writeToFile: { enabled: boolean };
  replaceInFile: { enabled: boolean };
  executeCommand: { enabled: boolean };
  // Security restrictions
  maxFileSizeKB: number;
  maxExecutionTimeSec: number;
  allowedFileExtensions: string[];
  allowedCommands: string[];
  // Tool-specific timeouts (in milliseconds)
  timeoutThinkingValidationMs: number;
  timeoutImpactAnalysisMs: number;
  timeoutAssumptionCheckerMs: number;
  timeoutDependencyMapperMs: number;
  timeoutThinkingOptimizerMs: number;
}

export class ToolCallingService {
  private config: ToolCallingConfig;
  private toolRegistry: ToolRegistry;

  constructor(config: ToolCallingConfig) {
    this.config = config;
    this.toolRegistry = createToolRegistry();
  }

  // ============================================================================
  // ENHANCED FILE READING (with modes: full/head/tail/range)
  // ============================================================================

  /**
   * Read file with mode support (enhanced version)
   */
  async readFileWithMode(
    args: ReadFileArgs
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    if (!this.config.readFile.enabled) {
      return {
        success: false,
        error: "File reading is disabled in configuration",
      };
    }

    // Validate file extension
    const fileExt = this.getFileExtension(args.path);
    if (!this.config.allowedFileExtensions.includes(fileExt)) {
      return {
        success: false,
        error: `File extension '${fileExt}' is not allowed. Allowed extensions: ${this.config.allowedFileExtensions.join(
          ", "
        )}`,
      };
    }

    try {
      const result = await this.toolRegistry.readFile(args);

      // Check file size limit if content was successfully read
      if (result.success && result.content) {
        const fileSizeKB = Buffer.byteLength(result.content, "utf8") / 1024;
        if (fileSizeKB > this.config.maxFileSizeKB) {
          return {
            success: false,
            error: `File size (${fileSizeKB.toFixed(
              1
            )}KB) exceeds maximum allowed size (${
              this.config.maxFileSizeKB
            }KB)`,
          };
        }
      }

      return {
        success: result.success,
        content: result.content,
        error: result.error,
      };
    } catch (error) {
      logger.error(`Error reading file ${args.path}:`, error);
      return {
        success: false,
        error: `Failed to read file: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Read multiple files concurrently with per-file mode support
   */
  async readMultipleFiles(
    files: ReadFileRequest[]
  ): Promise<{
    success: boolean;
    results: Array<{ path: string; content?: string; error?: string }>;
    error?: string;
  }> {
    if (!this.config.readFile.enabled) {
      return {
        success: false,
        results: [],
        error: "File reading is disabled in configuration",
      };
    }

    // Validate file extensions for all files
    for (const fileRequest of files) {
      const fileExt = this.getFileExtension(fileRequest.path);
      if (!this.config.allowedFileExtensions.includes(fileExt)) {
        return {
          success: false,
          results: [],
          error: `File extension '${fileExt}' is not allowed for ${fileRequest.path}. Allowed extensions: ${this.config.allowedFileExtensions.join(
            ", "
          )}`,
        };
      }
    }

    try {
      const result = await this.toolRegistry.readMultipleFiles({ files });

      // Check file size limits for all results
      for (const fileResult of result.results) {
        if (fileResult.content) {
          const fileSizeKB = Buffer.byteLength(fileResult.content, "utf8") / 1024;
          if (fileSizeKB > this.config.maxFileSizeKB) {
            fileResult.error = `File size (${fileSizeKB.toFixed(
              1
            )}KB) exceeds maximum allowed size (${
              this.config.maxFileSizeKB
            }KB)`;
            fileResult.content = undefined;
          }
        }
      }

      return {
        success: result.success,
        results: result.results,
      };
    } catch (error) {
      logger.error(`Error reading multiple files:`, error);
      return {
        success: false,
        results: [],
        error: `Failed to read files: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Legacy readFile method (backward compatibility)
   * Delegates to enhanced readFileWithMode
   */
  async readFile(
    filePath: string
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    return this.readFileWithMode({
      path: filePath,
      mode: "full",
    });
  }

  async listFiles(
    directoryPath: string,
    recursive: boolean = false
  ): Promise<{ success: boolean; files?: string[]; error?: string }> {
    if (!this.config.listFiles.enabled) {
      return {
        success: false,
        error: "Directory listing is disabled in configuration",
      };
    }

    try {
      const result = await this.toolRegistry.listFiles({
        path: directoryPath,
        recursive,
      });
      return {
        success: result.success,
        files: result.files,
        error: result.error,
      };
    } catch (error) {
      logger.error(`Error listing files in ${directoryPath}:`, error);
      return {
        success: false,
        error: `Failed to list files: ${(error as Error).message}`,
      };
    }
  }

  async grep(
    pattern: string,
    path: string,
    options?: { recursive?: boolean; caseSensitive?: boolean }
  ): Promise<{
    success: boolean;
    matches?: Array<{ file: string; line: number; content: string }>;
    error?: string;
  }> {
    if (!this.config.grep.enabled) {
      return {
        success: false,
        error: "Grep searching is disabled in configuration",
      };
    }

    try {
      const result = await this.toolRegistry.grep({
        pattern,
        path,
        recursive: options?.recursive ?? true,
        caseSensitive: options?.caseSensitive ?? false,
      });
      return {
        success: result.success,
        matches: result.matches,
        error: result.error,
      };
    } catch (error) {
      logger.error(`Error running grep in ${path}:`, error);
      return {
        success: false,
        error: `Grep failed: ${(error as Error).message}`,
      };
    }
  }

  async readManyFiles(filePaths: string[]): Promise<{
    success: boolean;
    files?: Array<{ path: string; content?: string; error?: string }>;
    error?: string;
  }> {
    if (!this.config.readFile.enabled) {
      return {
        success: false,
        error: "File reading is disabled in configuration",
      };
    }

    const results: Array<{ path: string; content?: string; error?: string }> =
      [];

    for (const filePath of filePaths) {
      const result = await this.readFile(filePath);
      results.push({
        path: filePath,
        content: result.content,
        error: result.error,
      });
    }

    return { success: true, files: results };
  }

  async executeCommand(
    command: string,
    workingDirectory?: string
  ): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
  }> {
    if (!this.config.executeCommand.enabled) {
      return {
        success: false,
        error: "Command execution is disabled in configuration",
      };
    }

    // Validate command against allowed commands list
    const isAllowed = this.config.allowedCommands.some((allowedCmd) =>
      command.startsWith(allowedCmd)
    );

    if (!isAllowed) {
      return {
        success: false,
        error: `Command not allowed: "${command}". Allowed commands start with: ${this.config.allowedCommands
          .slice(0, 10)
          .join(", ")}${this.config.allowedCommands.length > 10 ? "..." : ""}`,
      };
    }

    try {
      const cwd = workingDirectory ? resolve(workingDirectory) : process.cwd();
      const timeoutMs = this.config.maxExecutionTimeSec * 1000; // Convert to milliseconds

      const result = await execAsync(command, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      logger.error(`Error executing command "${command}":`, error);
      return {
        success: false,
        error: `Command execution failed: ${(error as Error).message}`,
        stdout: (error as any).stdout,
        stderr: (error as any).stderr,
      };
    }
  }

  // Placeholder methods for file writing operations (disabled for security)
  async writeFile(
    filePath: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.config.writeToFile.enabled) {
      return {
        success: false,
        error: "File writing is disabled in configuration for security reasons",
      };
    }
    return { success: false, error: "File writing not implemented" };
  }

  // ============================================================================
  // ENHANCED FILE EDITING (with matching strategies)
  // ============================================================================

  /**
   * Edit file with advanced matching strategies (enhanced version)
   */
  async editFile(
    args: EditFileArgs
  ): Promise<{
    success: boolean;
    diff?: string;
    changes?: {
      linesAdded: number;
      linesRemoved: number;
      editsApplied: number;
    };
    error?: string;
  }> {
    if (!this.config.replaceInFile.enabled) {
      return {
        success: false,
        error:
          "File editing is disabled in configuration for security reasons",
      };
    }

    // Validate file extension
    const fileExt = this.getFileExtension(args.path);
    if (!this.config.allowedFileExtensions.includes(fileExt)) {
      return {
        success: false,
        error: `File extension '${fileExt}' is not allowed for editing. Allowed extensions: ${this.config.allowedFileExtensions.join(
          ", "
        )}`,
      };
    }

    try {
      const result = await this.toolRegistry.editFile(args);
      return {
        success: result.success,
        diff: result.diff,
        changes: result.changes,
        error: result.error,
      };
    } catch (error) {
      logger.error(`Error editing file ${args.path}:`, error);
      return {
        success: false,
        error: `Failed to edit file: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Legacy replaceInFile method (backward compatibility)
   * Delegates to enhanced editFile with exact matching
   */
  async replaceInFile(
    filePath: string,
    oldString: string,
    newString: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.editFile({
      path: filePath,
      edits: [{ oldText: oldString, newText: newString, expectedOccurrences: 1 }],
      matchingStrategy: "exact",
      dryRun: false,
      failOnAmbiguous: true,
    });

    return {
      success: result.success,
      error: result.error,
    };
  }

  // Helper method to get file extension
  private getFileExtension(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    return ext ? `.${ext}` : "";
  }
}
