"use strict";

/**
 * @file getLines.js
 * @module ppl/utilities/validate/getLines
 * @description
 * Splits a string into an array of lines using a comprehensive newline regular expression.
 *
 * This utility handles standard and legacy line endings to ensure consistent
 * line-by-line processing across different operating systems.
 *
 * ## Supported Delimiters
 *
 * | Sequence | Description |
 * |----------|-------------|
 * | `\n`     | LF (Unix/macOS) |
 * | `\r\n`   | CRLF (Windows) |
 * | `\r`     | Legacy Mac (Classic Mac OS) |
 *
 * ## Design rationale
 *
 * - **Simplicity**: Uses the standard regex `/\r?\n|\r/g` which matches:
 *   - Optional `\r` followed by `\n` (handles both LF and CRLF)
 *   - Or standalone `\r` (legacy Mac)
 * - **Compatibility**: Handles all common line ending types found in real-world files.
 *
 * ## Stability contract
 *
 * This function is the primary entry point for all line-based analysis in the 
 * PPL pipeline. Changes to `LINE_SPLIT_RE` will directly impact line numbering 
 * for:
 * - Error reporting
 * - Indentation validation
 * - Section parsing
 *
 * @function getLines
 *
 * @param {string} content
 * The raw string content to be split. Non-string inputs are coerced to empty string.
 *
 * @returns {string[]}
 * An array of strings representing each line. Empty content returns `[""]`.
 *
 * @example
 * // Unix/macOS line endings
 * getLines("line1\nline2\nline3");
 * // → ["line1", "line2", "line3"]
 *
 * @example
 * // Windows line endings
 * getLines("line1\r\nline2\r\nline3");
 * // → ["line1", "line2", "line3"]
 *
 * @example
 * // Legacy Mac line endings
 * getLines("line1\rline2\rline3");
 * // → ["line1", "line2", "line3"]
 *
 * @example
 * // Mixed line endings
 * getLines("line1\nline2\r\nline3\rline4");
 * // → ["line1", "line2", "line3", "line4"]
 */
const LINE_SPLIT_RE = /\r?\n|\r/g;

const getLines = content => (content || "").split(LINE_SPLIT_RE);

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(getLines, "getLines", {
  value: getLines
}));