"use strict"

const checkLineStructure = require("./checkLineStructure");
const checkSectionContent = require("./checkSectionContent");
const checkSectionStructure = require("./checkSectionStructure");
const isValidUTF8 = require("./isValidUTF8");

/**
 * @file index.js
 * @module ppl/utilities/validate
 * @description
 * Orchestrates the complete validation pipeline for PPL (Prompt Programming Language) documents.
 *
 * This module serves as the main entry point for all validation operations, coordinating
 * three specialized validators to ensure document integrity before parsing and execution.
 *
 * ## Validation Pipeline
 *
 * | Phase | Validator | Checks |
 * |-------|-----------|--------|
 * | 1 | `isValidUTF8` | UTF-8 encoding compliance |
 * | 2 | `checkLineStructure` | Line endings, tabs, indentation rules |
 * | 3 | `checkSectionStructure` | Section headers, separators, required sections |
 *
 * ## Execution Order
 *
 * The validators run in a specific sequence because later validators assume the document
 * has already passed the checks of earlier ones:
 *
 * 1. **Encoding First** - UTF-8 validation ensures the content can be safely processed
 * 2. **Structure Second** - Line endings and indentation must be normalized for section parsing
 * 3. **Sections Last** - Macro-structure validation depends on properly split lines
 *
 * ## Feedback Aggregation
 *
 * All validators share a single `feedback` array, allowing:
 * - Centralized error/warning collection
 * - Consistent result formatting
 * - Line-number-based sorting for user-friendly output
 *
 * ## Stability contract
 *
 * This module defines the complete validation contract for the PPL pipeline. Any change
 * to the validation order or criteria must be carefully reviewed as it affects:
 * - All downstream parsing logic
 * - Error message consistency
 * - Template validation in CI/CD
 *
 * @function validate
 *
 * @param {string} content
 * The raw PPL document content to validate.
 *
 * @param {Array} [feedback=[]]
 * Reference array to collect feedback objects `{type, message, line}`.
 * If not provided, a new array is created.
 *
 * @returns {Array}
 * The updated feedback array, sorted by line number (ascending).
 *
 * @example
 * // Basic validation
 * const feedback = validate(pplContent);
 * if (feedback.some(f => f.type === "error")) {
 *   console.error("Validation failed:", feedback);
 * }
 *
 * @example
 * // With existing feedback array
 * const existingFeedback = [{ type: "info", message: "Pre-check passed" }];
 * const feedback = validate(pplContent, existingFeedback);
 * // feedback now contains both pre-check and validation results
 *
 * @example
 * // Handling validation results
 * const feedback = validate(pplContent);
 * const errors = feedback.filter(f => f.type === "error");
 * const warnings = feedback.filter(f => f.type === "warning");
 * 
 * errors.forEach(err => console.error(`Line ${err.line}: ${err.message}`));
 * warnings.forEach(warn => console.warn(`Line ${warn.line}: ${warn.message}`));
 */
const validate = (content, feedback) => {
  // Normalize input.
  feedback || (feedback = []);
  content || (content = "");

  // Check UTF-8 encoding.
  isValidUTF8(content)
    || feedback.push({ type: "error", message: `Prompt is not UTF8-encoded`, line: null });

  // Convert to string for further validation.
  Buffer.isBuffer(content) && (content = content.toString('utf8'));

  // Check prompt line structure.
  checkLineStructure(content, feedback);

  // Check prompt section format.
  checkSectionStructure(content, feedback);

  // Check section content.
  checkSectionContent(content, feedback);

  // Return reordered feedback by line.
  return feedback.sort((a, b) => (getLineNumForSort(a.line) - getLineNumForSort(b.line)));
}

const getLineNumForSort = line => (line === null || line === undefined) && Infinity || line || 0;

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(validate, "validate", {
  value: validate
}));