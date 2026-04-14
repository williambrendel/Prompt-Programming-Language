"use strict";

const { l2SquaredUnsafe } = require("./l2");

/**
 * @function dotProductUnsafe
 * @description
 * Computes the dot product of two numeric vectors without any input
 * validation. Skips all guard checks for maximum performance.
 *
 * The inner loop is **manually unrolled by 4** for performance, with a scalar
 * remainder loop handling trailing elements when `dim` is not a multiple of 4.
 *
 * **Fast path:** when `v1 === v2` and `offset1 === offset2`, delegates to
 * {@link l2SquaredUnsafe}, returning the squared magnitude directly.
 *
 * Prefer {@link dotProduct} unless the call site has already validated that
 * both vectors are non-empty arrays, `dim > 0`, and offsets are `>= 0`.
 *
 * Exposed as `dotProduct.dotProductUnsafe` for convenience.
 *
 * @param {number[]} v1          - First input vector. Must be a non-empty array.
 * @param {number[]} v2          - Second input vector. Must be a non-empty array.
 * @param {number}   dim         - Number of elements to process. Must be `> 0`.
 * @param {number}   [offset1=0] - Start index into `v1`. Must be `>= 0`.
 * @param {number}   [offset2=0] - Start index into `v2`. Must be `>= 0`.
 *
 * @returns {number} The dot product of the specified sub-ranges of `v1` and
 *                   `v2`, or the squared magnitude via {@link l2SquaredUnsafe}
 *                   when `v1 === v2` and `offset1 === offset2`.
 *
 * @example
 * dotProduct.dotProductUnsafe([1, 2, 3], [4, 5, 6], 3, 0, 0);
 * // => 1*4 + 2*5 + 3*6 = 32
 *
 * @example
 * // Same-reference fast path
 * const v = [3, 4];
 * dotProduct.dotProductUnsafe(v, v, 2, 0, 0);
 * // => 3*3 + 4*4 = 25
 */
const dotProductUnsafe = (v1, v2, dim, offset1 = 0, offset2 = 0) => {
  // Fast path: return squared magnitude via l2SquaredUnsafe when both refs and offsets match.
  if (v1 === v2 && offset1 === offset2) return l2SquaredUnsafe(v1, dim, offset1);

  // Compute dot product by increment of 4 for faster computation.
  let d = 0, o1 = offset1, o2 = offset2, res = 0;
  for (; d < dim; d += 4, o1 += 4, o2 += 4) {
    res += v1[o1] * v2[o2]
      + v1[o1 + 1] * v2[o2 + 1]
      + v1[o1 + 2] * v2[o2 + 2]
      + v1[o1 + 3] * v2[o2 + 3];
  }

  // Remainder if dim is not a multiple of 4.
  for (d > dim && (d -= 4, o1 -= 4, o2 -= 4); d !== dim; ++d, ++o1, ++o2) {
    res += v1[o1] * v2[o2];
  }

  return res;
}

/**
 * @function dotProduct
 * @description
 * Computes the dot product of two numeric arrays (or vectors), optionally
 * restricted to a sub-range via `dim`, `offset1`, and `offset2`.
 *
 * The inner loop is **manually unrolled by 4** for performance — four
 * multiply-accumulate operations are executed per iteration, with a scalar
 * remainder loop handling any trailing elements when `dim` is not a multiple
 * of 4.
 *
 * **Input normalization:** if either `v1` or `v2` is falsy, the other is used
 * as a fallback. Returns `0` immediately if both are non-arrays, if `dim`
 * resolves to zero, or if either input is empty.
 *
 * **Fast path:** when `v1 === v2` and `offset1 === offset2`, computation is
 * delegated to {@link l2SquaredUnsafe} via {@link dotProductUnsafe}, returning
 * the squared magnitude directly without a redundant two-vector pass.
 *
 * The unsafe variant is accessible as `dotProduct.dotProductUnsafe`.
 *
 * @param {number[]} [v1]        - First input vector. Falls back to `v2` if falsy.
 * @param {number[]} [v2]        - Second input vector. Falls back to `v1` if falsy.
 * @param {number}   [dim]       - Number of elements to process. Defaults to
 *                                 `Math.min(v1.length, v2.length)`.
 * @param {number}   [offset1=0] - Start index into `v1`. Clamped to `>= 0`.
 * @param {number}   [offset2=0] - Start index into `v2`. Clamped to `>= 0`.
 *
 * @returns {number} The dot product of the specified sub-ranges of `v1` and
 *                   `v2`, or the squared magnitude via {@link l2SquaredUnsafe}
 *                   when `v1 === v2` and `offset1 === offset2`, or `0` if
 *                   inputs are invalid.
 *
 * @example
 * // Full dot product
 * dotProduct([1, 2, 3], [4, 5, 6]);
 * // => 1*4 + 2*5 + 3*6 = 32
 *
 * @example
 * // Same-reference fast path — squared magnitude via l2SquaredUnsafe
 * const v = [3, 4];
 * dotProduct(v, v);
 * // => 3*3 + 4*4 = 25
 *
 * @example
 * // Single vector — squared magnitude
 * dotProduct([3, 4]);
 * // => 25  (v2 falls back to v1)
 *
 * @example
 * // Invalid input
 * dotProduct(null, null);
 * // => 0
 *
 * @example
 * // Sub-range with offsets
 * dotProduct([0, 1, 2, 3], [0, 4, 5, 6], 2, 2, 1);
 * // processes v1[2..3] · v2[1..2] = 2*4 + 3*5 = 23
 */
const dotProduct = (v1, v2, dim, offset1, offset2) => {
  // Normalize entry.
  v1 || (v1 = v2);
  v2 || (v2 = v1);
  if (!(Array.isArray(v1) && Array.isArray(v2))) return 0;

  dim || (dim = Math.min(v1.length, v2.length));
  if (!(dim > 0)) return 0;

  offset1 = Math.max(offset1 || 0, 0);
  offset2 = Math.max(offset2 || 0, 0);

  return dotProductUnsafe(v1, v2, dim, offset1, offset2);
}

/**
 * @name dotProduct.dotProductUnsafe
 * @type {dotProductUnsafe}
 * @description Alias for {@link dotProductUnsafe}. Computes the dot product
 *              without input validation.
 */
dotProduct.dotProductUnsafe = dotProductUnsafe;

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(dotProduct, "dotProduct", {
  value: dotProduct
}));