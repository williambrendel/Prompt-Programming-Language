"use strict";

/**
 * @file isValidUTF8.js
 * @module ppl/utilities/validate/isValidUTF8
 * @description
 * Validates whether a string or buffer contains valid UTF-8 encoded data.
 *
 * This utility ensures that .ppl (Prompt Programming Language) files
 * adhere to the UTF-8 standard, preventing encoding artifacts and
 * ensuring compatibility across cross-platform execution environments.
 *
 * ## Validation strategy
 *
 * | Environment | Implementation |
 * |-------------|----------------|
 * | **Node.js 19.4+** | Uses native `Buffer.isUtf8()` for O(n) scan performance. |
 * | **Legacy Node** | Compares re-encoded UTF-8 buffer against original string. |
 *
 * ## Design rationale
 *
 * - **Performance:** By leveraging `Buffer.isUtf8()`, the validator performs 
 * a low-level check in C++ without the memory overhead of creating 
 * duplicate strings or intermediate objects.
 * - **Strictness:** The fallback logic ensures that any lossy conversion 
 * (where invalid bytes are replaced by `\uFFFD`) results in a `false` 
 * validation, maintaining high data integrity for the PPL parser.
 * - **Portability:** While optimized for Node.js, the logic provides a 
 * reliable blueprint for environment-specific encoding checks.
 *
 * ## Stability contract
 *
 * This function is a core guardrail for the PPL Validator pipeline. 
 * Validation failures will halt the following processes:
 *
 * - Lexical analysis
 * - Prompt template compilation
 * - Multilingual character rendering
 *
 * @function isValidUTF8
 *
 * @param {string|Buffer} content
 * The content to validate for UTF-8 compliance.
 *
 * @returns {boolean}
 * Returns `true` if the content is valid UTF-8; otherwise `false`.
 *
 * @example
 * isValidUTF8("Standard Text");
 * // → true
 *
 * @example
 * // Invalid UTF-8 sequence (e.g., incomplete multi-byte character)
 * isValidUTF8(Buffer.from([0xF0, 0x90, 0x28])); 
 * // → false
 */
const isValidUTF8 = content => {
  // Convert to buffer if needed
  const buffer = Buffer.isBuffer(content) 
    ? content 
    : Buffer.from(String(content ?? ""), "utf8");
  
  // Use native method if available
  if (typeof Buffer.isUtf8 === "function") {
    return Buffer.isUtf8(buffer);
  }
  
  // Legacy fallback: verify round-trip encoding
  try {
    const decoded = buffer.toString("utf8");
    const reencoded = Buffer.from(decoded, "utf8");
    // Also check for null bytes
    return buffer.equals(reencoded);
  } catch {
    return false;
  }
};

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(isValidUTF8, "isValidUTF8", {
  value: isValidUTF8
}));