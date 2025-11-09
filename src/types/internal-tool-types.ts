/**
 * Type definitions for enhanced internal tools
 * Focused on text file operations only (no document parsing)
 */

import { z } from "zod";

// ============================================================================
// READ FILE SCHEMAS
// ============================================================================

/**
 * Schema for reading a single file with mode support
 * Supports: full, head, tail, range modes
 */
export const ReadFileArgsSchema = z
  .object({
    path: z.string().describe("Path to text file to read"),
    mode: z
      .enum(["full", "head", "tail", "range"])
      .optional()
      .default("full")
      .describe(
        "Read mode: full (entire file), head (first N lines), tail (last N lines), range (lines X to Y)"
      ),
    lines: z
      .number()
      .positive()
      .int()
      .optional()
      .describe("Number of lines (required for head/tail modes)"),
    startLine: z
      .number()
      .positive()
      .int()
      .optional()
      .describe("Start line number (1-indexed, required for range mode)"),
    endLine: z
      .number()
      .positive()
      .int()
      .optional()
      .describe(
        "End line number (1-indexed, inclusive, required for range mode)"
      ),
  })
  .refine(
    (data) => {
      // Validation for head/tail modes
      if (data.mode === "head" || data.mode === "tail") {
        if (!data.lines) return false;
        if (data.startLine !== undefined || data.endLine !== undefined)
          return false;
      }
      // Validation for range mode
      if (data.mode === "range") {
        if (!data.startLine || !data.endLine) return false;
        if (data.startLine > data.endLine) return false;
        if (data.lines !== undefined) return false;
      }
      // Validation for full mode
      if (data.mode === "full") {
        if (
          data.lines !== undefined ||
          data.startLine !== undefined ||
          data.endLine !== undefined
        ) {
          return false;
        }
      }
      return true;
    },
    {
      message:
        "Invalid parameter combination. " +
        "For 'head' or 'tail' mode: 'lines' is required (startLine/endLine not allowed). " +
        "For 'range' mode: both 'startLine' and 'endLine' are required (startLine <= endLine), 'lines' not allowed. " +
        "For 'full' mode: no optional parameters should be provided.",
    }
  );

/**
 * Individual file read request (for batch operations)
 */
export const ReadFileRequestSchema = ReadFileArgsSchema;

/**
 * Schema for reading multiple files concurrently
 * Each file can have its own mode specification
 */
export const ReadMultipleFilesArgsSchema = z.object({
  files: z
    .array(ReadFileRequestSchema)
    .min(1, "At least one file must be provided")
    .max(50, "Maximum 50 files per operation")
    .describe(
      "Array of file read requests with individual mode specifications"
    ),
});

// ============================================================================
// EDIT FILE SCHEMAS
// ============================================================================

/**
 * Single edit operation
 * Supports multiple matching strategies and validation
 */
export const EditOperation = z.object({
  oldText: z
    .string()
    .describe(
      "Text to search for - include 3-5 lines of context for reliable matching"
    ),
  newText: z.string().describe("Text to replace with"),
  instruction: z
    .string()
    .optional()
    .describe("Optional: Semantic description of what this edit does and why"),
  expectedOccurrences: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe("Expected number of occurrences to replace (defaults to 1)"),
});

/**
 * Schema for editing a file with multiple strategies
 * Supports: exact, flexible, fuzzy, auto matching
 */
export const EditFileArgsSchema = z.object({
  path: z.string().describe("Path to text file to edit"),
  edits: z
    .array(EditOperation)
    .min(1)
    .describe("Array of edits to apply sequentially"),
  matchingStrategy: z
    .enum(["exact", "flexible", "fuzzy", "auto"])
    .optional()
    .default("auto")
    .describe(
      "Matching strategy: exact → flexible → fuzzy, or 'auto' to try all"
    ),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe("Preview changes without writing"),
  failOnAmbiguous: z
    .boolean()
    .optional()
    .default(true)
    .describe("Fail when oldText matches multiple locations"),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>;
export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>;
export type ReadMultipleFilesArgs = z.infer<typeof ReadMultipleFilesArgsSchema>;
export type EditFileArgs = z.infer<typeof EditFileArgsSchema>;
export type EditOperationType = z.infer<typeof EditOperation>;

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface ReadFileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface ReadMultipleFilesResult {
  success: boolean;
  results: Array<{
    path: string;
    content?: string;
    error?: string;
  }>;
}

export interface EditFileResult {
  success: boolean;
  diff?: string;
  changes?: {
    linesAdded: number;
    linesRemoved: number;
    editsApplied: number;
  };
  error?: string;
}

