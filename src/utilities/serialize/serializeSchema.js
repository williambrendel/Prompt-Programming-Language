/**
 * @file serializeSchema.js
 * @brief A utility for serializing objects or strings into Markdown code blocks.
 */

"use strict";

/**
 * @function isValidShema
 * @description Validates if the provided schema is a non-empty object or a string.
 * @param {*} schema - The input to validate.
 * @returns {boolean} True if schema is a non-empty object or a string; otherwise false.
 */
const isValidShema = schema => schema && (
  typeof schema === "object" && Object.keys(schema).length || typeof schema === "string"
);

/**
 * @function serializeSchema
 * @description Serializes a schema into a Markdown-formatted code block.
 * * @param {Object|string} schema - The schema data to serialize.
 * @param {string} [format=""] - The language identifier for the Markdown code block (e.g., "json", "yaml").
 * @param {string} [indent="  "] - The indentation string used if the schema is an object.
 * @param {string} [out=""] - An optional initial string to prepend to the output.
 * * @returns {string} A Markdown code block string, or an empty string if the schema is invalid.
 * * @example
 * const json = { name: "test", version: 1 };
 * serializeSchema(json, "json");
 * // Returns:
 * // ```json
 * // {
 * //   "name": "test",
 * //   "version": 1
 * // }
 * // ```
 */
const serializeSchema = (schema, format, indent = "  ", out = "") => isValidShema(schema) && (
  (
    out += `\`\`\`${(format || "").toLowerCase()}\n`,
    out += (
      typeof schema === "object" && JSON.stringify(schema, null, indent) || `${schema}`
    ),
    out += "\n\`\`\`"
  )
) || "";

/**
 * @ignore
 * Default export with freezing.
 * The function is exported as a frozen object containing itself as a property.
 */
serializeSchema.isValidShema = isValidShema;
module.exports = Object.freeze(Object.defineProperty(serializeSchema, "serializeSchema", {
  value: serializeSchema
}));