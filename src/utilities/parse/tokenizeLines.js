/**
 * @file tokenizeLines.js
 * @brief Expands inline control-flow expressions into properly indented lines.
 *
 * @details
 * Any line that contains more than one keyword boundary is split in-place into
 * multiple indented sub-lines, so the main stack-based parser can handle nested
 * control-flow structures without special-casing inline expressions.
 *
 * The tokenization process:
 * 1. Normalizes whitespace in the input line
 * 2. Identifies PPL keywords (IF, THEN, ELSE, ENDIF, GOTO, etc.)
 * 3. Splits the line at keyword boundaries
 * 4. Applies indentation rules based on keyword nesting depth
 * 5. Returns an array of properly indented line objects
 *
 * @example
 * // tokenizeLines returns objects with toString method
 * const result = tokenizeLines(["    IF $x >= 0.7 THEN GOTO @gen ELSE GOTO @fall"]);
 * // result.map(obj => obj.toString()) gives:
 * // [
 * //     "    IF",
 * //     "      $x >= 0.7",
 * //     "    THEN",
 * //     "      GOTO @gen",
 * //     "    ELSE",
 * //     "      GOTO @fall"
 * //   ]
 */

"use strict";

const { getBaseKeyword, getEndKeyword, isActionKeyword, getTitle } = require("../nameUtils");

/**
 * @function tokenizeLines
 * @description 
 * Walks an array of raw PPL lines, expanding inline control-flow
 * expressions into properly indented sub-lines.
 * * Each line is passed through `tokenizeLine`, which returns an array of
 * immutable objects. The results are spread into the output array.
 *
 * @param {string[]} lines         - Array of raw PPL lines
 * @param {string}   [indent="  "] - Indentation string (one level)
 * @param {Object}   [options]     - Optional configuration flags (passed to tokenizeLine)
 * @returns {Object[]} Normalized array of line objects with indentation metadata
 *
 * @example
 * tokenizeLines(["IF x THEN IF y THEN z ENDIF ELSE w"])
 * // → [
 * //     { value: "IF", indent: "", level: 0 },
 * //     { value: "x", indent: "  ", level: 2 },
 * //     { value: "THEN", indent: "", level: 0 },
 * //     { value: "IF", indent: "  ", level: 2 },
 * //     { value: "y", indent: "    ", level: 4 },
 * //     { value: "THEN", indent: "  ", level: 2 },
 * //     { value: "z", indent: "    ", level: 4 },
 * //     { value: "ENDIF", indent: "  ", level: 2 },
 * //     { value: "ELSE", indent: "", level: 0 },
 * //     { value: "w", indent: "  ", level: 2 }
 * //   ]
 */
const tokenizeLines = (lines, indent = "  ", options) => {
  if (!Array.isArray(lines)) return [];
  const newLines = [];

  for (let i = 0, l = lines.length; i !== l; ++i) {
    const line = lines[i], tokens = tokenizeLine(line, indent, options);
    newLines.push(...tokens);
  }

  return newLines;
};

/**
 * @function createLine
 * @description
 * Creates an immutable line object with indentation metadata.
 * 
 * Factory function that produces a frozen object representing a line of PPL code
 * with its associated indentation.
 * 
 * **Parameter Normalization Logic:**
 * 
 * 1. **Value normalization**:
 *    - If `value` is a string → used as-is
 *    - If `value` is null/undefined → converts to empty string `""`
 *    - Otherwise → converts using template literal `` `${value}` ``
 * 
 * 2. **Indent normalization** (applied in order):
 *    - If `indent` is truthy → uses that as indent string
 *    - If `indent` is falsy → sets to `""` (empty string)
 *    - If `level` is undefined → sets `level = indent.length`
 *    - If `level` is provided and `level !== indent.length` → recreates `indent` as `level` spaces
 * 
 * **Returned Object Structure:**
 * ```js
 * {
 *   value: string,    // The line content
 *   indent: string,   // Indentation string (spaces or custom)
 *   level: number,    // indentation level (usually indent.length)
 *   toString: function // Returns `${indent}${value}`
 * }
 * ```
 * 
 * The object is frozen, making it immutable and safe for caching.
 * 
 * @param {string|any} [value=""] - Line content (non-strings are coerced)
 * @param {string} [indent=""]    - Indentation string
 * @param {number} [level]        - Indentation level (if provided and differs from 
 *                                  indent.length, indent is recreated as level spaces)
 * @returns {Object} Immutable line object with toString method
 * 
 * @example
 * // Standard usage with explicit indent
 * const line = createLine("IF condition", "  ");
 * console.log(line.value);      // "IF condition"
 * console.log(line.indent);     // "  "
 * console.log(line.level);      // 2
 * console.log(line.toString()); // "  IF condition"
 * 
 * @example
 * // Using level to generate spaces
 * const line = createLine("THEN", null, 4);
 * console.log(line.indent);     // "    "
 * console.log(line.level);      // 4
 * console.log(line.toString()); // "    THEN"
 * 
 * @example
 * // Minimal usage
 * const line = createLine("GOTO @target");
 * console.log(line.indent);     // ""
 * console.log(line.level);      // 0
 * console.log(line.toString()); // "GOTO @target"
 * 
 * @see tokenizeLine
 * @see tokenizeLines
 */
const createLine = (value, indent, level) => (
  typeof value !== "string" && (
    value = value !== undefined && value !== null && `${value}` || ""
  ),
  indent || (indent = ""),
  level !== undefined || (level = indent.length),
  level !== indent.length && (indent = (" ").repeat(level)),
  Object.freeze(Object.defineProperty({
    value,
    indent,
    level
  }, "toString", {
    value: () => `${indent}${value}`
  }))
);

/**
 * @constant {Map<string, Object>} CACHE
 * @private
 * @description
 * Memoization cache for `tokenizeLine` results.
 * 
 * Keyed by the normalized trimmed line content. Each entry stores:
 * - `indentLevel`: Number of leading whitespace characters from original line
 * - `tokens`: Expanded array of indented sub-lines
 *
 * On cache hit, the stored `indentLevel` leading spaces are replaced with the
 * current call's `baseIndent` via regex substitution, making the cache
 * indent-agnostic with respect to the base indentation of any given line.
 *
 * The cache can be:
 * - Cleared on demand via `tokenizeLine(line, indent, { clearCache: true })`
 * - Bypassed entirely with `{ useCache: false }`
 */
const CACHE = new Map();
 
/**
 * @constant {RegExp} SPLIT_RE
 * @private
 * @description Matches one or more whitespace characters globally.
 * 
 * @details
 * Used to collapse internal whitespace sequences into a single space when
 * normalizing a line before keyword detection, and to split the normalized
 * string into individual words.
 */
const SPLIT_RE = /\s+/g;

/**
 * @file tokenizeLines.js
 * @description 
 * Expands inline control-flow expressions into properly indented lines.
 *
 * Any line that contains more than one keyword boundary is split in-place into
 * multiple indented sub-lines, so the main stack-based parser can handle nested
 * control-flow structures without special-casing inline expressions.
 *
 * The tokenization process:
 * 1. Normalizes whitespace in the input line
 * 2. Identifies PPL keywords (IF, THEN, ELSE, ENDIF, GOTO, etc.)
 * 3. Splits the line at keyword boundaries
 * 4. Applies indentation rules based on keyword nesting depth
 * 5. Returns an array of properly indented line objects
 * 
 * // Use .toString() or normalizeLines to get string representation
 * result.map(obj => obj.toString()) // → ["IF", "  $x >= 0.7", "THEN", "  GOTO", "    @gen"]
 * 
 * @example
 * tokenizeLine("IF $x >= 0.7 THEN GOTO @gen")
 * // → [
 * //     { value: "IF", indent: "", level: 0 },
 * //     { value: "$x >= 0.7", indent: "  ", level: 2 },
 * //     { value: "THEN", indent: "", level: 0 },
 * //     { value: "GOTO", indent: "  ", level: 2 },
 * //     { value: "@gen", indent: "    ", level: 4 }
 * //   ]
 *
 * @example
 * // tokenizeLines returns objects with toString method
 * const result = tokenizeLines(["    IF $x >= 0.7 THEN GOTO @gen ELSE GOTO @fall"]);
 * // result.map(obj => obj.toString()) gives:
 * // [
 * //     "    IF",
 * //     "      $x >= 0.7",
 * //     "    THEN",
 * //     "      GOTO @gen",
 * //     "    ELSE",
 * //     "      GOTO @fall"
 * //   ]
 */
const tokenizeLine = (line, indent, options) => {
  // Normalize indent.
  indent || (indent = "  ");

  const {
    clearCache = false,
    useCache = true
  } = options || {};

  // Clear cache if needed.
  clearCache && CACHE.clear();

  // Trim line.
  let trimmed = line.trimStart(), baseIndentLevel = line.length - trimmed.length;
  trimmed = trimmed.trimEnd().replace(SPLIT_RE, " "); // fully normalized

  // Return cached line if found.
  const baseIndent = line.slice(0, baseIndentLevel),
    cacheKey = `${trimmed}|${indent}`,
    cached = useCache && CACHE.get(cacheKey);
  if (cached) {
    const {
      indentLevel,
      tokens
    } = cached;
    const re = new RegExp(`^\\s{${indentLevel}}`);
    return tokens.map(x => x = createLine(x.value, x.indent.replace(re, baseIndent)));
  }

  // Get the base indent.
  const words = trimmed.split(SPLIT_RE), tokens = [], sliceAmount = -indent.length;

  // Build tokens.
  line = "";
  let curIndent = baseIndent;
  for (let i = 0, l = words.length, word, ekw, kw, indented, doSlice; i !== l; ++i) {
    // Indent if past token was a base keyword.
    kw && !ekw && (
      curIndent += indent,
      indented = true
    ) || (
      indented = indented === undefined
    );

    // Check for keywords.
    kw = (getTitle(word = words[i])) && (
      (ekw = getEndKeyword(word))
      || getBaseKeyword(word)
    );

    // Push keywords.
    if (kw) {
      // Push line if needed.
      line && tokens.push(createLine(line, curIndent));
      line = "";

      // Adjust indentation.
      indented || (curIndent = curIndent.slice(0, sliceAmount));
      doSlice && (curIndent = curIndent.slice(0, sliceAmount));
      curIndent.length < baseIndent.length && (curIndent = baseIndent);

      // Push keyword.
      tokens.push(createLine(kw, curIndent));

      // Update slicing.
      doSlice = isActionKeyword(kw);

      continue;
    }

    // Push words, with current indent at the begining.
    line += line && ` ${word}` || word;
  }

  // Push last line if needed.
  line && tokens.push(createLine(line, curIndent));

  // Cache output.
  useCache && CACHE.set(cacheKey, { indentLevel: baseIndentLevel, tokens });
  return tokens;
}

/**
 * @function normalizeLines
 * @description 
 * Converts tokenized line objects to their string representations.
 * 
 * Takes the output from `tokenizeLine` (which returns an array of `Line` objects
 * with indentation metadata) and maps each object to its string representation
 * by invoking the `toString` method. This effectively flattens the structured
 * line objects into plain strings with proper indentation applied.
 * 
 * This function is useful when:
 * - The tokenized output needs to be written to a file or console
 * - The structured representation is no longer needed for further processing
 * - Converting between internal representation and output format
 * 
 * @param {Array<Line|string>} lines - Array of `Line` objects or string lines
 *                                     from `tokenizeLine`
 * @returns {string[]} Array of properly indented string lines
 * 
 * @example
 * // Tokenize a line with inline control-flow
 * const tokens = tokenizeLine("IF x THEN GOTO @label ELSE RETURN");
 * // tokens → [Line("IF"), Line("  x"), Line("THEN"), 
 * //           Line("  GOTO @label"), Line("ELSE"), Line("  RETURN")]
 * 
 * const strings = normalizeLines(tokens);
 * // strings → ["IF", "  x", "THEN", "  GOTO @label", "ELSE", "  RETURN"]
 * 
 * @example
 * // Direct use with tokenizeLines
 * const normalized = normalizeLines(tokenizeLines([
 *   "IF condition THEN action ELSE fallback"
 * ]));
 * // → ["IF", "  condition", "THEN", "  action", "ELSE", "  fallback"]
 * 
 * @see tokenizeLine
 * @see tokenizeLines
 * @see Line#toString
 */
const normalizeLines = (...args) => tokenizeLines(...args).map( line => `${line}`);

/**
 * @ignore
 * Default export with freezing.
 */
tokenizeLine.createLine = createLine;
tokenizeLines.tokenizeLine = tokenizeLine;
tokenizeLines.normalizeLines = normalizeLines;
module.exports = Object.freeze(Object.defineProperty(tokenizeLines, "tokenizeLines", {
  value: tokenizeLines
}));