/**
 * @file nameUtils.js
 * @brief Utilities for validating keywords, titles, and specific variable patterns.
 */

"use strict";

/**
 * @constant {Set<string>} KEYWORDS
 * @private
 * @description A collection of reserved control flow and declaration keywords.
 */
const KEYWORDS = new Set([
  "DO", "EXECUTE", "RUN", "CHECK", "VALIDATE", "EVAL", "EVALUATE", "FAILURE",
  "NEXT", "GOTO", "GO_TO", "GO TO", "TO", "IF", "THEN", "ELSE", "ELSEIF",
  "ELSE_IF", "ELSE IF", "IF", "IF", "EACH", "FOR", "FOR", "FOR",
  "WHILE", "WHILE", "WHILE", "LOOP", "LOOP", "LOOP", "CONTINUE",
  "UNTIL", "BREAK", "RETURN", "STOP", "ITERATE", "FOREACH", "FOR_EACH",
  "FOR EACH", "MAP", "REDUCE", "FILTER", "IN", "AS", "OF", "DEFINE",
  "DECLARE", "LET", "CONST", "VAR"
]);


/** @private @type {number} Minimum length of any string in the KEYWORDS set. */
let MIN_KEYWORD_LENGTH = Infinity;
/** @private @type {number} Maximum length of any string in the KEYWORDS set. */
let MAX_KEYWORD_LENGTH = 0;

KEYWORDS.forEach(v => {
  MIN_KEYWORD_LENGTH = Math.min(MIN_KEYWORD_LENGTH, v.length);
  MAX_KEYWORD_LENGTH = Math.max(MAX_KEYWORD_LENGTH, v.length);
});

/**
 * @function getBaseKeyword
 * @description Validates if a string is a reserved base keyword (case-insensitive).
 * 
 * @param {string} str - The string to check.
 * 
 * @returns {string} The uppercase keyword if found, otherwise "".
 * 
 * @example
 * getBaseKeyword("foreach"); // returns "FOREACH"
 * getBaseKeyword("apple");   // returns false
 */
const getBaseKeyword = str => str && typeof str === "string"
  && str.length >= MIN_KEYWORD_LENGTH
  && str.length <= MAX_KEYWORD_LENGTH
  && KEYWORDS.has(str = str.toUpperCase())
  && str
  || "";

/**
 * @constant {RegExp} END_RE
 * @private
 * @description Regular expression to test if a keyword starts with "END" (case-insensitive).
 */
const END_RE = /^end([\s\-\_]+|)/i;

/**
 * @function getEndKeyword
 * @description Validates if a string is a reserved END keyword (case-insensitive).
 * 
 * @param {string} str - The string to check.
 * 
 * @returns {string} The uppercase keyword if found, otherwise "".
 * 
 * @example
 * getEndKeyword("end if"); // returns "ENDIF"
 * getEndKeyword("foreach"); // returns ""
 * getKeyword("apple");   // returns ""
 */
const getEndKeyword = str => (
  str && typeof str === "string" && END_RE.test(str)
    && (str = getBaseKeyword(str.replace(END_RE, "")))
    && `END${str}` // normalize keyword
    || ""
);

/**
 * @function getKeyword
 * @description Validates if a string is a reserved keyword (case-insensitive).
 * 
 * @param {string} str - The string to check.
 * 
 * @returns {string} The uppercase keyword if found, otherwise "".
 * 
 * @example
 * getKeyword("foreach"); // returns "FOREACH"
 * getKeyword("end if"); // returns "ENDIF"
 * getKeyword("apple");   // returns ""
 */
const getKeyword = str => getEndKeyword(str) || getBaseKeyword(str);

/**
 * @function isBaseKeyword
 * @description Boolean check for base keyword existence.
 * 
 * @param {string} str - The string to check.
 * 
 * @returns {boolean} True if the string is a reserved base keyword.
 */
const isBaseKeyword = str => !!getBaseKeyword(str);

/**
 * @function isEndKeyword
 * @description Boolean check for END keyword existence.
 * 
 * @param {string} str - The string to check.
 * 
 * @returns {boolean} True if the string is a reserved END keyword.
 */
const isEndKeyword = str => !!getEndKeyword(str);

/**
 * @function isKeyword
 * @description Boolean check for keyword existence.
 * 
 * @param {string} str - The string to check.
 * 
 * @returns {boolean} True if the string is a reserved keyword.
 */
const isKeyword = str => !!getKeyword(str);

/**
 * @constant {Set<string>} BLOCK_TYPES
 * @private
 * @description Reserved block type keywords that introduce a named block with @name: syntax.
 */
const BLOCK_TYPES = new Set(["GOAL", "STEP", "SUBSTEP", "TASK"]);

/**
 * @function getBlockType
 * @description Validates if a string is a reserved block type (case-insensitive).
 *
 * @param {string} str - The string to check.
 *
 * @returns {string} The uppercase block type if found, otherwise empty string.
 *
 * @example
 * getBlockType("goal");    // → "GOAL"
 * getBlockType("SUBSTEP"); // → "SUBSTEP"
 * getBlockType("task");    // → ""
 */
const getBlockType = str => (
  str && typeof str === "string"
  && BLOCK_TYPES.has(str = str.toUpperCase())
  && str || ""
);

/**
 * @function isBlockType
 * @description Boolean check for block type existence.
 *
 * @param {string} str - The string to check.
 *
 * @returns {boolean} True if the string is a reserved block type.
 */
const isBlockType = str => !!getBlockType(str);

/**
 * @function isTitle
 * @description Checks if a string is a "Title" (all uppercase/symbols, no lowercase).
 * Strictly enforces that no character code exceeds 95 (underscore) and at least 
 * one character is an uppercase letter (65-90).
 * 
 * @param {string} str - The string to validate.
 * 
 * @returns {boolean} True if the string meets title criteria.
 * 
 * @example
 * isTitle("MY_CONSTANT_123"); // true
 * isTitle("MyConstant");      // false
 */
const isTitle = str => {
  if (!str || typeof str !== "string" || str.charCodeAt(0) > 96) return false;
  
  let hasUppercase = false;
  
  // Already checked first character.
  for (let i = 1, l = str.length, code; i !== l; ++i) {
    code = str.charCodeAt(i);
    
    // Lowercase letter or invalid symbol found - immediate fail
    if (code > 95) return false; // lower case or invalid symbol found --> fail
    
    // Uppercase letter found
    code > 64 && code < 91 && (hasUppercase = true);
  }
  
  return hasUppercase;
}

/**
 * @function getTitle
 * @description Returns the string unchanged if it qualifies as a title
 * (all uppercase, no lowercase letters), otherwise returns an empty string.
 * Acts as the value-returning counterpart to {@link isTitle}.
 *
 * @param {string} str - The string to validate.
 *
 * @returns {string} The original string if it is a valid title, otherwise `""`.
 *
 * @example
 * getTitle("USER INPUTS"); // → "USER INPUTS"
 * getTitle("TO ACHIEVE");  // → "TO ACHIEVE"
 * getTitle("GOAL");        // → "GOAL"
 * getTitle("myVar");       // → ""
 * getTitle("Goal");        // → ""
 */
const getTitle = str => isTitle(str) && str || "";

/**
 * @function isVariable
 * @description Identifies if a string matches specific "input" or "output" variable patterns.
 * Patterns: "input" (length 5-6) or "output" (length 6-7).
 * 
 * @param {string} name - The variable name to check.
 * 
 * @returns {boolean} True if it matches the naming convention.
 * 
 * @example
 * isVariable("input");  // true
 * isVariable("inputs");  // true
 * isVariable("output");  // true
 * isVariable("outputs");  // true
 * isVariable("myVar");    // false
 */
const isVariable = name => name && typeof name === "string" && name.length > 4 && name.length < 8 && (
  name = name.toLowerCase(),
  name.startsWith("input") && name.length < 7
    || name.startsWith("output")
) || false;

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze({
  getBaseKeyword,
  getEndKeyword,
  getKeyword,
  getTitle,
  isBaseKeyword,
  isEndKeyword,
  isKeyword,
  getBlockType,
  isBlockType,
  isTitle,
  isVariable
});