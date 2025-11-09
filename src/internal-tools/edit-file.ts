/**
 * Edit File Tool - Advanced text replacement with multiple matching strategies
 *
 * Supports intelligent text replacement with:
 * - Exact matching (character-for-character)
 * - Flexible matching (whitespace-insensitive)
 * - Fuzzy matching (token-based)
 * - Auto mode (tries all strategies in order)
 *
 * Text files only (no document parsing)
 */

import { promises as fs } from "fs";
import {
  EditFileArgs,
  EditFileResult,
  EditFileArgsSchema,
  EditOperationType,
} from "../types/internal-tool-types.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MatchResult {
  strategy: "exact" | "flexible" | "fuzzy";
  occurrences: number;
  modifiedContent: string;
  message: string;
  warning?: string;
  lineRange?: {
    start: number;
    end: number;
  };
  ambiguity?: {
    locations: string;
    suggestion: string;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Detect line ending style in content
 */
function detectLineEnding(content: string): "\r\n" | "\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Normalize line endings to \n for processing
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Restore original line endings
 */
function restoreLineEndings(text: string, lineEnding: "\r\n" | "\n"): string {
  if (lineEnding === "\r\n") {
    return text.replace(/\n/g, "\r\n");
  }
  return text;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// MATCHING STRATEGIES
// ============================================================================

/**
 * Try exact string match
 */
function tryExactMatch(
  content: string,
  oldText: string,
  newText: string
): MatchResult | null {
  const searchText = normalizeLineEndings(oldText);
  const replaceText = normalizeLineEndings(newText);

  // Count occurrences
  const escapedSearch = escapeRegex(searchText);
  const occurrences = (content.match(new RegExp(escapedSearch, "g")) || [])
    .length;

  if (occurrences === 0) {
    return null;
  }

  // Replace all occurrences
  const modified = content.replace(new RegExp(escapedSearch, "g"), replaceText);

  // Calculate line position for first occurrence
  const firstMatchIndex = content.indexOf(searchText);
  const linesBeforeMatch = content.substring(0, firstMatchIndex).split("\n")
    .length;

  let result: MatchResult = {
    strategy: "exact",
    occurrences,
    modifiedContent: modified,
    message: `Exact match found at line ${linesBeforeMatch}`,
    lineRange: {
      start: linesBeforeMatch,
      end: linesBeforeMatch + searchText.split("\n").length - 1,
    },
  };

  // Add ambiguity warning if multiple matches
  if (occurrences > 1) {
    const allMatches: number[] = [];
    let currentIndex = 0;
    while (true) {
      const matchIndex = content.indexOf(searchText, currentIndex);
      if (matchIndex === -1) break;
      const lineNum = content.substring(0, matchIndex).split("\n").length;
      allMatches.push(lineNum);
      currentIndex = matchIndex + searchText.length;
    }

    result.ambiguity = {
      locations: allMatches.join(", "),
      suggestion: "Add more context lines to uniquely identify the target location",
    };
  }

  return result;
}

/**
 * Try flexible match (whitespace-insensitive, line-by-line)
 */
function tryFlexibleMatch(
  content: string,
  oldText: string,
  newText: string
): MatchResult | null {
  const searchText = normalizeLineEndings(oldText);
  const searchLines = searchText.split("\n");

  if (searchLines.length === 0) {
    return null;
  }

  const contentLines = content.split("\n");
  const matches: number[] = [];

  // Search for sequence of lines with flexible whitespace matching
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let isMatch = true;

    for (let j = 0; j < searchLines.length; j++) {
      const searchLine = searchLines[j].trim();
      const contentLine = contentLines[i + j].trim();

      if (searchLine !== contentLine) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      matches.push(i);
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Apply replacement preserving indentation
  let modified = content;
  const replaceLines = normalizeLineEndings(newText).split("\n");

  // Replace in reverse order to preserve indices
  for (let i = matches.length - 1; i >= 0; i--) {
    const matchIndex = matches[i];
    const originalIndent = contentLines[matchIndex].match(/^\s*/)?.[0] || "";

    // Apply indentation to replacement
    const indentedReplace = replaceLines
      .map((line, idx) => {
        if (idx === 0) return originalIndent + line.trim();
        if (line.trim() === "") return "";
        return originalIndent + line.trim();
      })
      .join("\n");

    // Replace the matched lines
    const beforeLines = contentLines.slice(0, matchIndex);
    const afterLines = contentLines.slice(matchIndex + searchLines.length);
    contentLines.splice(matchIndex, searchLines.length, indentedReplace);
    modified = [...beforeLines, indentedReplace, ...afterLines].join("\n");
  }

  const firstMatchLine = matches[0] + 1;

  return {
    strategy: "flexible",
    occurrences: matches.length,
    modifiedContent: modified,
    message: `Flexible match found at line ${firstMatchLine}`,
    lineRange: {
      start: firstMatchLine,
      end: firstMatchLine + searchLines.length - 1,
    },
    warning: matches.length > 1
      ? `Found ${matches.length} matches at lines: ${matches.map((m) => m + 1).join(", ")}`
      : undefined,
  };
}

/**
 * Try fuzzy match (token-based, most permissive)
 */
function tryFuzzyMatch(
  content: string,
  oldText: string,
  newText: string
): MatchResult | null {
  // Tokenize search text (split on whitespace, preserve structure)
  let tokenizedSearch = normalizeLineEndings(oldText).trim();

  // Handle common delimiters
  const delimiters = ["(", ")", "{", "}", "[", "]", ";", ",", ":", "="];
  for (const delim of delimiters) {
    tokenizedSearch = tokenizedSearch.split(delim).join(` ${delim} `);
  }

  // Split on whitespace and filter empties
  const tokens = tokenizedSearch.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return null;
  }

  // Build regex: tokens separated by flexible whitespace
  const escapedTokens = tokens.map((t) => escapeRegex(t));
  const pattern = `^(\\s*)${escapedTokens.join("\\s*")}`;
  const fuzzyRegex = new RegExp(pattern, "m");

  const match = fuzzyRegex.exec(content);

  if (!match) {
    return null;
  }

  const matchedText = match[0];
  const indentation = match[1] || "";

  // Apply indentation to replacement
  const replaceLines = newText.split("\n");
  const indentedReplace = replaceLines
    .map((line) => {
      if (line.trim() === "") return "";
      return indentation + line.trim();
    })
    .join("\n");

  const modified = content.replace(fuzzyRegex, indentedReplace);

  // Calculate approximate position
  const linesBeforeMatch = content.substring(0, match.index).split("\n").length;

  return {
    strategy: "fuzzy",
    occurrences: 1, // Fuzzy match only replaces first occurrence
    modifiedContent: modified,
    message: `Fuzzy match found near line ${linesBeforeMatch}`,
    lineRange: {
      start: linesBeforeMatch,
      end: linesBeforeMatch + matchedText.split("\n").length - 1,
    },
    warning:
      "Fuzzy matching was used. Please review changes carefully to ensure accuracy.",
  };
}

// ============================================================================
// STRATEGY APPLICATION
// ============================================================================

/**
 * Apply edit with strategy selection
 */
function applyEditWithStrategy(
  content: string,
  edit: EditOperationType,
  strategy: "exact" | "flexible" | "fuzzy" | "auto",
  failOnAmbiguous: boolean
): MatchResult {
  let result: MatchResult | null = null;
  const attemptedStrategies: string[] = [];

  if (strategy === "auto") {
    // Try each strategy in order: exact → flexible → fuzzy
    result = tryExactMatch(content, edit.oldText, edit.newText);
    if (result) {
      if (
        failOnAmbiguous &&
        result.occurrences > 1 &&
        (!edit.expectedOccurrences || edit.expectedOccurrences === 1)
      ) {
        throw new Error(
          `Ambiguous match: found ${result.occurrences} occurrences of the search text.\n` +
          (edit.instruction ? `Edit: ${edit.instruction}\n` : "") +
          `Locations: ${result.ambiguity?.locations || "multiple"}\n` +
          `Suggestion: ${result.ambiguity?.suggestion || "Add more context to uniquely identify the target"
          }`
        );
      }
      return result;
    }
    attemptedStrategies.push("exact");

    result = tryFlexibleMatch(content, edit.oldText, edit.newText);
    if (result) {
      if (
        failOnAmbiguous &&
        result.occurrences > 1 &&
        (!edit.expectedOccurrences || edit.expectedOccurrences === 1)
      ) {
        throw new Error(
          `Ambiguous match: found ${result.occurrences} occurrences of the search text.\n` +
          (edit.instruction ? `Edit: ${edit.instruction}\n` : "") +
          `Locations: ${result.warning || "multiple"}\n` +
          `Suggestion: Add more context to uniquely identify the target`
        );
      }
      return result;
    }
    attemptedStrategies.push("flexible");

    result = tryFuzzyMatch(content, edit.oldText, edit.newText);
    if (result) return result;
    attemptedStrategies.push("fuzzy");
  } else {
    // Use specified strategy only
    switch (strategy) {
      case "exact":
        result = tryExactMatch(content, edit.oldText, edit.newText);
        attemptedStrategies.push("exact");
        break;
      case "flexible":
        result = tryFlexibleMatch(content, edit.oldText, edit.newText);
        attemptedStrategies.push("flexible");
        break;
      case "fuzzy":
        result = tryFuzzyMatch(content, edit.oldText, edit.newText);
        attemptedStrategies.push("fuzzy");
        break;
    }

    if (
      result &&
      failOnAmbiguous &&
      result.occurrences > 1 &&
      (!edit.expectedOccurrences || edit.expectedOccurrences === 1)
    ) {
      throw new Error(
        `Ambiguous match: found ${result.occurrences} occurrences of the search text.\n` +
        (edit.instruction ? `Edit: ${edit.instruction}\n` : "") +
        `Suggestion: Add more context to uniquely identify the target`
      );
    }
  }

  // No match found - throw error
  if (!result) {
    let errorMsg = "Failed to apply edit";
    if (edit.instruction) {
      errorMsg += `\nEdit goal: ${edit.instruction}`;
    }
    errorMsg += `\n\nSearched for:\n${edit.oldText}\n`;
    errorMsg += `\nAttempted strategies: ${attemptedStrategies.join(", ")}`;
    errorMsg += `\n\nTroubleshooting tips:`;
    errorMsg += `\n- Ensure oldText matches the file content exactly (check whitespace, indentation)`;
    errorMsg += `\n- Include 3-5 lines of context before and after the target change`;
    errorMsg += `\n- Try matchingStrategy: "flexible" if whitespace is the issue`;

    throw new Error(errorMsg);
  }

  // Validate occurrence count
  if (
    edit.expectedOccurrences &&
    result.occurrences !== edit.expectedOccurrences
  ) {
    throw new Error(
      `Expected ${edit.expectedOccurrences} occurrence(s) but found ${result.occurrences}\n` +
      (edit.instruction ? `Edit: ${edit.instruction}\n` : "") +
      `Strategy used: ${result.strategy}`
    );
  }

  return result;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Apply edits to a file with advanced matching strategies
 */
export async function editFileTool(args: EditFileArgs): Promise<EditFileResult> {
  try {
    // Validate args with Zod schema
    const validated = EditFileArgsSchema.parse(args);
    const {
      path,
      edits,
      matchingStrategy = "auto",
      dryRun = false,
      failOnAmbiguous = true,
    } = validated;

    // Read file content and detect original line ending
    const rawContent = await fs.readFile(path, "utf-8");
    const originalLineEnding = detectLineEnding(rawContent);

    // Normalize line endings for processing
    let content = normalizeLineEndings(rawContent);

    // Apply edits sequentially, tracking results
    const editResults: MatchResult[] = [];
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;

    for (const edit of edits) {
      const result = applyEditWithStrategy(
        content,
        edit,
        matchingStrategy,
        failOnAmbiguous
      );
      editResults.push(result);
      content = result.modifiedContent;

      // Calculate line changes
      const oldLines = edit.oldText.split("\n").length;
      const newLines = edit.newText.split("\n").length;
      totalLinesRemoved += oldLines;
      totalLinesAdded += newLines;
    }

    // Restore original line endings
    const finalContent = restoreLineEndings(content, originalLineEnding);

    // Write file if not dry run
    if (!dryRun) {
      await fs.writeFile(path, finalContent, "utf-8");
    }

    // Generate diff summary
    const diffSummary = editResults
      .map(
        (r, idx) =>
          `Edit ${idx + 1}: ${r.strategy} match at line ${r.lineRange?.start || "?"
          } (${r.occurrences} occurrence${r.occurrences > 1 ? "s" : ""})`
      )
      .join("\n");

    return {
      success: true,
      diff: `${dryRun ? "[DRY RUN] " : ""}Applied ${edits.length} edit(s)\n\n${diffSummary}`,
      changes: {
        linesAdded: totalLinesAdded,
        linesRemoved: totalLinesRemoved,
        editsApplied: edits.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

