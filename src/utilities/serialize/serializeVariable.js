/**
 * @file serializeVariable.js
 * @brief Utility for serializing variable objects into normalized, indented strings.
 */

"use strict";

const serializeSchema = require("./serializeSchema");
const { normalizeVariableName } = require("./normalizeUtils");
const serializeField = require("./serializeField");
const indentText = require("./indentText");

/**
 * @function serializeVariable
 * @description Transforms a variable definition into a formatted string. 
 * Handles prefixing, indentation of metadata, and schema serialization.
 * 
 * @param {string|Object} variable - The variable to serialize.
 * @param {string} [variable.name] - The name of the variable (required if object).
 * @param {string} [variable.description] - A text description of the variable.
 * @param {string} [variable.format] - The data format (e.g., "json", "csv").
 * @param {string|Object|Array} [variable.provenance] - Source or history information.
 * @param {Object|string} [variable.schema] - Data structure definition.
 * @param {string} [indent="  "] - The indentation string for nested blocks.
 * 
 * @throws {Error} If the variable is not a string/object or is an object missing a name.
 * 
 * @returns {string} The fully serialized variable string.
 * 
 * @example
 * // Simple string input
 * serializeVariable("userCount"); 
 * // returns: "$user_count"
 * 
 * @example
 * // Simple object input
 * const varObj = {
 *   name: "user_list",
 *   description: "List of active users"
 * };
 * serializeVariable("userCount"); 
 * // returns: "$user_list: List of active users"
 * 
 * @example
 * // Simple object input with multiline description
 * const varObj = {
 *   name: "user_list",
 *   description: "List of active users\nUsefull for counts"
 * };
 * serializeVariable("userCount"); 
 * // returns: "$user_list:\n  List of active users\n  Usefull for counts"
 * 
 * @example
 * // Complex object input
 * const varObj = {
 *   name: "user_list",
 *   description: "List of active users",
 *   format: "json",
 *   schema: { type: "array", items: "string" }
 * };
 * serializeVariable(varObj, "  ");
 * // returns:
 * // "$user_list:
 * //   description: List of active users
 * //   format: json
 * //   schema:
 * //     ```json
 * //     {
 * //       "type": "array",
 * //       "items": "string"
 * //     }
 * //     ```"
 */
const serializeVariable = (variable, indent = "  ") => {
  // Invalid variable check.
  if (!(variable && (typeof variable === "string" || typeof variable === "object"))) {
    throw Error(`${variable} is not a valid variable, must be an object or a string`);
  }

  // Handle simple string variables.
  if (typeof variable === "string") return `${normalizeVariableName(variable)}`;

  let {
    name,
    description,
    format,
    provenance,
    schema
  } = variable;

  // Validation for object structure.
  if (!name) {
    throw Error(`Variable:\n${JSON.stringify(variable, null, 2)} \nis missing its name`);
  }
  
  name = `${normalizeVariableName(name)}`;
  description = serializeField("description", description, indent);
  
  let meta = [];
  
  // Serialize, indent, and add Provenance.
  provenance && meta.push(`${indent}provenance: ${provenance}`);
  
  // Add Format.
  format && meta.push(`${indent}format: ${format}`);
  
  // Serialize, wrap, and double-indent Schema.
  schema && (
    schema = serializeSchema(schema, format, indent),
    schema && meta.push(`${indent}schema:\n${indentText(schema, indent + indent)}`)
  );

  // Final metadata composition.
  meta = meta.length && (
    description && ("\n" + indentText(description, indent) + "\n" + meta.join("\n"))
    || ("\n" + meta.join("\n"))
  ) || description.slice(12)

  return meta && `${name}:${meta}` || name;
}
serializeVariable.VALUE_SERIALIZER = true;

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(serializeVariable, "serializeVariable", {
  value: serializeVariable
}));