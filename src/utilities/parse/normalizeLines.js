/**
 * @file normalizeLines.js
 * @brief Expands inline control-flow expressions into properly indented lines.
 *
 * Any line that contains more than one keyword boundary is split in-place into
 * multiple indented sub-lines, so the main stack-based parser can handle nested
 * control-flow structures without special-casing inline expressions.
 *
 * @example
 * normalizeLines(["    IF $x >= 0.7 THEN GOTO @gen ELSE GOTO @fall"])
 * // → [
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
 * @function normalizeLines
 * @description Walks an array of raw PPL lines. Each line is passed through
 * `tokenizeLine`, which returns either the original line (no expansion needed)
 * or an array of properly indented sub-lines. The results are spread into the
 * output array.
 *
 * @param {string[]} lines         - Array of raw PPL lines.
 * @param {string}   [indent="  "] - Indentation string (one level).
 * @returns {string[]} Normalized line array with inline expressions expanded.
 *
 * @example
 * normalizeLines(["IF x THEN IF y THEN z ENDIF ELSE w"])
 * // → ["IF", "  x", "THEN", "  IF", "    y", "  THEN", "    z", "  ENDIF", "ELSE", "  w"]
 */
const normalizeLines = (lines, indent = "  ", options) => {
  if (!Array.isArray(lines)) return [];
  const newLines = [];

  for (let i = 0, l = lines.length; i !== l; ++i) {
    const line = lines[i], tokens = tokenizeLine(line, indent, options) || [line];
    newLines.push(...tokens);
  }

  return newLines;
};

/**
 * @constant {Map} CACHE
 * @private
 * @description Memoization cache for `tokenizeLine` results, keyed by the
 * normalized trimmed line content. Each entry stores `{ indentLevel, tokens }`
 * where `indentLevel` is the number of leading whitespace characters from the
 * original line and `tokens` is the expanded array of indented sub-lines.
 *
 * On cache hit the stored `indentLevel` leading spaces are replaced with the
 * current call's `baseIndent` via regex substitution, making the cache
 * indent-agnostic with respect to the base indentation of any given line.
 *
 * Can be cleared on demand via `tokenizeLine(line, indent, { clearCache: true })`
 * or bypassed entirely with `{ useCache: false }`.
 */
const CACHE = new Map();
 
/**
 * @constant {RegExp} SPLIT_RE
 * @private
 * @description Matches one or more whitespace characters globally. Used to
 * collapse internal whitespace sequences into a single space when normalizing
 * a line before keyword detection, and to split the normalized string into
 * individual words.
 */
const SPLIT_RE = /\s+/g;

/**
 * @function tokenizeLine
 * @description Splits a single PPL line into an array of properly indented
 * lines. Returns `[line]` unchanged if the line contains fewer than two
 * keyword tokens.
 *
 * Depth rules (applied word-by-word, left-to-right):
 * - Previous word was a base keyword → `curIndent += indent` (`indented = true`)
 * - `indented` is false when entering a keyword → pop one level
 * - `indented` is true when entering a keyword  → keep pushed level
 *
 * This gives N consecutive keywords N levels of nesting, and any keyword
 * following content automatically pops back one level. END* keywords never
 * set `indented` (via `kw && !ekw`), so the keyword following them always pops.
 *
 * Results are memoized by `trimmed + "|" + indent`.
 *
 * @param {string} line            - A raw PPL line (may include leading whitespace).
 * @param {string} [indent="  "]   - Indentation string (one level).
 * @param {Object} [options]       - Optional flags.
 * @param {boolean} [options.clearCache=false] - Clear the memoization cache before processing.
 * @param {boolean} [options.useCache=true]    - Whether to read/write the cache.
 * @returns {string[]} One or more indented lines.
 *
 * @example
 * tokenizeLine("IF $x >= 0.7 THEN GOTO @gen ELSE GOTO @fall")
 * // → ["IF", "  $x >= 0.7", "THEN", "  GOTO @gen", "ELSE", "  GOTO @fall"]
 *
 * @example
 * tokenizeLine("tokenize $question")  // no keywords — unchanged
 * // → ["tokenize $question"]
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
    cached = useCache && CACHE.get(trimmed);
  if (cached) {
    const {
      indentLevel,
      tokens
    } = cached;
    const re = new RegExp(`^\\s{${indentLevel}}`);
    return tokens.map(x => x.replace(re, baseIndent));
  }

  // Get the base indent.
  const words = trimmed.split(SPLIT_RE), tokens = [], sliceAmount = -indent.length;

  // Build tokens.
  line = "";
  for (let i = 0, l = words.length, word, ekw, kw, indented, curIndent = baseIndent, doSlice; i !== l; ++i) {
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
      line && tokens.push(line);
      line = "";

      // Adjust indentation.
      indented || (curIndent = curIndent.slice(0, sliceAmount));
      doSlice && (curIndent = curIndent.slice(0, sliceAmount));

      // Push keyword.
      tokens.push(`${curIndent}${kw}`);

      // Update slicing.
      doSlice = isActionKeyword(kw);

      continue;
    }

    // Push words, with current indent at the begining.
    line += line && ` ${word}` || `${curIndent}${word}`;
  }

  // Push last line if needed.
  line && tokens.push(line);

  // Cache output.
  useCache && CACHE.set(trimmed, { indentLevel: baseIndentLevel, tokens });
  return tokens;
}

/**
 * @ignore
 * Default export with freezing.
 */
normalizeLines.tokenizeLine = tokenizeLine;
module.exports = Object.freeze(Object.defineProperty(normalizeLines, "normalizeLines", {
  value: normalizeLines
}));