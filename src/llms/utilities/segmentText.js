"use strict";

/**
 * @function segmentText
 * @description Splits a text string into segments delimited by punctuation and
 * newline characters, returning the byte-range of each segment as a `[start, end]`
 * index pair. Leading and trailing whitespace and punctuation are trimmed from the
 * entire input before segmentation. Empty or whitespace-only segments are silently
 * discarded.
 *
 * **Delimiter characters (by ASCII code):**
 * `\n` (10), `\r` (13), `!` (33), `,` (44), `.` (46), `:` (58), `;` (59), `?` (63)
 *
 * Each returned pair `[s, e]` represents a half-open range: `text.slice(s, e)`.
 * Whitespace immediately before or after a delimiter is excluded from the adjacent
 * segment's range — segments always start and end on a non-whitespace character.
 *
 * @param {string|*} text - Input text to segment. Non-string values are coerced via
 *   template literal. Falsy values return an empty array immediately.
 *
 * @returns {Array<[number, number]>} Array of `[start, end]` index pairs, one per
 *   non-empty segment. Returns `[]` if `text` is falsy or contains only
 *   delimiter/whitespace characters.
 *
 * @example
 * segmentText("Hello, world. How are you?");
 * // → [ [0, 5], [7, 12], [14, 26] ]
 *
 * @example
 * segmentText("  \n  ");
 * // → []
 *
 * @example
 * segmentText("One sentence only");
 * // → [ [0, 17] ]
 *
 * @example
 * // Reconstruct segments as strings:
 * const segs = segmentText(text);
 * const strings = segs.map(([s, e]) => text.slice(s, e));
 */
const segmentText = text => {
  if (!text) return [];
  typeof text === "string" || (text = `${text}`);
  const len = text.length, delimIndices = new Uint32Array(len);
  let n = 0, m = 0, p = 0, s = 0, e = len - 1, c;

  // Find start and end of the text.
  // 10: \n, 13: \r, 33: !, 44: ,, 46: ., 58: :, 59: ;, 63: ?
  while (s !== len && (c = text.charCodeAt(s)) < 64 && (
    c < 14 && c > 8 || c === 32
    || c === 33 || c === 44 ||  c === 46 
    || c === 58 || c === 59 || c === 63
  )) ++s;
  while (e > s && (c = text.charCodeAt(e)) < 64 && (
    c < 14 && c > 8 || c === 32
    || c === 33 || c === 44 ||  c === 46 
    || c === 58 || c === 59 || c === 63
  )) --e;

  if (s === len) return [];
  ++e < s && (e = s);
  
  for (let i = s; i !== e; ++i) {
    c = text.charCodeAt(i);

    // Check for common punctuation and new lines using ASCII codes:
    // 10: \n, 13: \r, 33: !, 44: ,, 46: ., 58: :, 59: ;, 63: ?
    c < 64 && (
      c === 10 || c === 13 || c === 33 || c === 44 || 
      c === 46 || c === 58 || c === 59 || c === 63
    ) && (delimIndices[n++] = i);
  }

  const segments = new Array(n + 2);
  p = s;

  for (let i = 0, j, k; i !== n; ++ i) {
    // Refine segments.
    // Find Real end (i.e. non-space end).
    j = (k = delimIndices[i]) - 1;
    while (j >= p && ((c = text.charCodeAt(j)) < 14 && c > 8 || c === 32)) --j;
    (++j > p) && (
      segments[m++] = [p, j]
    );
    p = k + 1;
    // Find Real start (i.e. non-space start).
    while (p !== e && ((c = text.charCodeAt(p)) < 14 && c > 8 || c === 32)) ++p;
  }
  // Add last potential segement.
  p < e && (segments[m++] = [p, e]);

  // Resize segment.
  segments.length = m;

  return segments;
}