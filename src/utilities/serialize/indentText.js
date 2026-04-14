/**
 * @file indentText.js
 * @brief Utility for prefixing text blocks with consistent indentation.
 */

"use strict"

/**
 * @constant {RegExp} RE
 * @private
 * @description Matches a newline character followed by a non-newline character.
 * Used to identify the start of new lines within a text block for indentation injection.
 */
const RE = /(\n)([^\n])/g;

/**
 * @function indentText
 * @description Prefixes a string with a specified indentation and ensures all 
 * internal newlines are followed by the same indentation.
 * 
 * @param {string} text - The raw text block to be indented.
 * @param {string} [indent="  "] - The string (usually spaces or tabs) to use for indentation.
 * @param {boolean} [indentFirstLine=true] - If true, the very first line of the text will also be indented.
 * 
 * @returns {string} The processed text with indentation applied, or an empty string if text is falsy.
 * 
 * @example
 * const result = indentText("Hello\nWorld", "  ");
 * // returns: "  Hello\n  World"
 */
const indentText = (text, indent = "  ", indentFirstLine = true) => text && (
  (indentFirstLine && indent || "") + text.replace(RE, `$1${indent}$2`)
) || "";

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(indentText, "indentText", {
  value: indentText
}));