"use strict";

/**
 * @file getLines.js
 * @module ppl/utilities/validate/getLines
 * @description
 * Splits a string into an array of lines using a comprehensive newline regular expression.
 *
 * This utility handles standard, non-standard, and legacy line endings to ensure
 * consistent line-by-line processing across different operating systems and 
 * malformed buffers.
 *
 * ## Supported Delimiters
 *
 * | Sequence | Description |
 * |----------|-------------|
 * | `\n`     | LF (Unix/macOS) |
 * | `\r\n`   | CRLF (Windows) |
 * | `\r`     | Legacy Mac |
 * | `\r\r`   | Invalid/Double Carriage Return |
 * | `\n\r`   | Invalid/Reverse Newline |
 *
 * ## Design rationale
 *
 * - **Robustness**: Uses a specific order in the regex (greedy matching) to ensure 
 * multi-character endings like `\r\n` are matched as a single delimiter 
 * rather than two separate lines.
 * - **Normalization**: By treating all variations as valid split points, it 
 * prevents empty string artifacts that occur when using simpler split patterns 
 * on heterogeneous files.
 *
 * ## Stability contract
 *
 * This function is the primary entry point for all line-based analysis in the 
 * MOON pipeline. Changes to `LINE_SPLIT_RE` will directly impact line numbering 
 * for:
 * - Error reporting
 * - Indentation validation
 * - Schema parsing
 *
 * @function getLines
 *
 * @param {string} content
 * The raw string content to be split.
 *
 * @returns {string[]}
 * An array of strings representing each line.
 *
 * @example
 * getLines("line1\nline2\r\nline3");
 * // → ["line1", "line2", "line3"]
 */
const LINE_SPLIT_RE = /\r\r|\n\r|\r\n|\n|\r/g;

const getLines = content => (content || "").split(LINE_SPLIT_RE);

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(getLines, "getLines", {
  value: getLines
}));