"use strict";

const getLines = require("./getLines");

/**
 * @file checkLineStructure.js
 * @module ppl/utilities/validate/checkLineStructure
 * @description
 * Validates the structural integrity of string content based on line endings and indentation.
 *
 * This function acts as a structural linter, ensuring that code follows specific 
 * formatting standards regarding whitespace and line termination before further 
 * processing or schema analysis.
 *
 * ## Validation rules
 *
 * | Category       | Rule                                  | Severity |
 * |----------------|---------------------------------------|----------|
 * | Line Endings   | Must use LF (`\n`) or CRLF (`\r\n`)   | Error    |
 * | Line Endings   | `\r\r` or `\n\r` sequences forbidden  | Error    |
 * | Indentation    | Tabs (`\t`) are strictly forbidden    | Error    |
 * | Indentation    | Must be a multiple of 2 spaces        | Warning  |
 * | Indentation    | Increments must not exceed 2 spaces   | Warning  |
 *
 * ## Design rationale
 *
 * - **Early Detection**: Line ending errors are caught using a global regex scan 
 * before the content is split into lines to ensure malformed buffers are identified.
 * - **Unified Feedback**: Accepts a single `feedback` array to aggregate results, 
 * maintaining consistency with other PPL validation utilities.
 * - **Indentation State**: Tracks `lastIndentationLength` to detect "jumping" 
 * levels, which helps catch copy-paste errors or missing block closures.
 *
 * ## Stability contract
 *
 * This function enforces the physical layout constraints for all PPL-compatible 
 * source files. Modifications to the regex or indentation logic will trigger 
 * different linting results in the CI/CD pipeline.
 *
 * @function checkLineStructure
 *
 * @param {string} content
 * The raw string content to validate.
 *
 * @param {Array} [feedback=[]]
 * Reference array to store feedback objects `{type, message, line}`.
 *
 * @returns {Array}
 * The updated feedback array.
 *
 * @example
 * const feedback = [];
 * checkLineStructure("  bad\r\rline", feedback);
 * // feedback[0].type → "error"
 */
const INVALID_ENDING_RE = /\r\r|\n\r/, NEWLINE_RE = /\r\r|\n\r|\r\n|\n|\r/g;
const checkLineStructure = (content, feedback) => {
  // Normalize input.
  feedback || (feedback = []);
  content || (content = "");

  // Line Endings
  const arr = content.match(NEWLINE_RE) || [],
    o = !(content.startsWith("\n") || content.startsWith("\r"));
  for (let i = 0, l = arr.length; i !== l; ++i) {
    INVALID_ENDING_RE.test(arr[i]) && feedback.push({
      type: "error",
      message: `Invalid line endings. Use LF (\\n) or CRLF (\\r\\n) only.`,
      line: i + 1 + o
    });
  }

  // Get the lines.
  const lines = getLines(content);

  // Indentation.
  for (let i = 0, l = lines.length, lastIndentationLength = 0; i !== l; ++i) {
    const line = lines[i] || "", trimmed = line.trimStart();
    if (!trimmed) continue; // blank line

    const indentation = line.slice(0, line.length - trimmed.length) || "";
    
    // If no indentation, reset the tracking but don't exit.
    if (!indentation) {
      lastIndentationLength = 0;
      continue;
    }

    // Check for tabs.
    indentation.includes("\t") && feedback.push({ 
      type: "error", 
      message: "Tabs are not allowed. Use spaces only.", 
      line: i + 1 
    });

    // Check for odd indentation spaces.
    indentation.length & 1 && feedback.push({ 
      type: "warning", 
      message: `Indentation should be a multiple of 2 spaces`, 
      line: i + 1 
    });

    // Check for incremental indentation.
    indentation.length - lastIndentationLength > 2 && feedback.push({ 
      type: "warning", 
      message: `Too indented. Should increment by 2 spaces`, 
      line: i + 1 
    });

    // Update last indentation length.
    lastIndentationLength = indentation.length;
  }

  return feedback;
};

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(checkLineStructure, "checkLineStructure", {
  value: checkLineStructure
}));