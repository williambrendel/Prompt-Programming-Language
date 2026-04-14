/**
 * @file serializeField.js
 * @brief Utility for serializing diverse data types into formatted string fields.
 */

"use strict";

const getLines = require("../getLines");
const { getKeyword, isTitle, isVariable } = require("../nameUtils");
const indentText = require("./indentText");

/**
 * @function serializeField
 * @description Serializes a named field and its value into a formatted PPL string.
 * Supports automatic indentation, list formatting for arrays, and recursive object
 * serialization in PPL key: value format.
 *
 * Behavior by value type:
 * - **null / undefined / empty object / empty array** — returns empty string immediately.
 * - **Primitive (non-object)** — stringified and trimmed. Single-line values produce
 *   `"name: value"`. Multi-line values are either indented under the field name or
 *   converted to an indexed array (see `options.createArray`).
 * - **Plain object** — serialized via `options.objSerializer` if provided, otherwise
 *   via the default PPL `key: value` serializer. Always produces a block format.
 *   If `options.objSerializer` is `serializeVariable`, it is used directly without
 *   wrapping in `createObjectSerializer`.
 * - **Array** — flattened, then single-item arrays are unwrapped and treated as a
 *   primitive. Multi-item arrays produce an indexed `"names[N]:"` block with `- item`
 *   entries. Object items are serialized via `objSerializer` (defaults to
 *   `_serializeObject`).
 *
 * @param {string} name - The label/name of the field.
 * @param {*} value - The data to serialize. Accepts string, number, boolean, object, or array.
 * @param {string} [indent="  "] - The string used for each indentation level.
 * @param {Object} [options={}] - Optional serialization configuration.
 * @param {Function} [options.objSerializer] - Custom function to stringify objects.
 *   Receives `(obj, indent, options)` and must return a string. When provided,
 *   single-line results go inline; multi-line results produce a block.
 *   Special case: if `serializeVariable` is passed, it is used directly as the
 *   serializer without the `createObjectSerializer` wrapper.
 *   Defaults to the internal PPL `_serializeObject`.
 * @param {Function} [options.serializeObject] - Alias for `options.objSerializer`.
 * @param {boolean} [options.createArray=false] - When true, multi-line string values
 *   are split into lines and emitted as an indexed `"names[N]:"` array block instead
 *   of an indented text block.
 *
 * @returns {string} The formatted PPL field string, or an empty string if the value
 *   is null, undefined, empty, or produces no non-whitespace content.
 *
 * @example
 * // Single-line string
 * serializeField("title", "Hello World");
 * // → "title: Hello World"
 *
 * @example
 * // Multi-line string — indented block (createArray=false, default)
 * serializeField("note", "Line 1\nLine 2", "  ");
 * // → "note:\n  Line 1\n  Line 2"
 *
 * @example
 * // Multi-line string — array block (createArray=true)
 * serializeField("note", "Line 1\nLine 2", "  ", { createArray: true });
 * // → "notes[2]:\n  - Line 1\n  - Line 2"
 *
 * @example
 * // Array with multiple items
 * serializeField("tag", ["js", "node"], "  ");
 * // → "tags[2]:\n  - js\n  - node"
 *
 * @example
 * // Array with single item — unwrapped to scalar
 * serializeField("tag", ["js"], "  ");
 * // → "tag: js"
 *
 * @example
 * // Plain object — serialized in PPL key: value format, always block
 * serializeField("meta", { version: 1 }, "  ");
 * // → "meta:\n  version: 1"
 *
 * @example
 * // Nested object — recursively serialized
 * serializeField("user", { name: "string", address: { city: "string" } }, "  ");
 * // → "user:\n  name: string\n  address:\n    city: string"
 *
 * @example
 * // Custom object serializer returning scalar — goes inline
 * serializeField("data", { key: "value" }, "  ", { objSerializer: o => o.key });
 * // → "data: value"
 *
 * @example
 * // serializeVariable as objSerializer — used directly, no wrapper
 * serializeField("input", { name: "question", format: "text" }, "  ", { objSerializer: serializeVariable });
 * // → delegates directly to serializeVariable
 *
 * @example
 * // Null or undefined — returns empty string
 * serializeField("title", null);       // → ""
 * serializeField("title", undefined);  // → ""
 *
 * @see {@link getLines} for line splitting behavior
 * @see {@link indentText} for indentation behavior
 */
const serializeField = (name, value, indent = "  ", options) => {

  // Gard against empty values.
  if (
    value === null
      || value === undefined
      || (
        typeof value === "object" && (
          Array.isArray(value) && !value.length
          || !Object.keys(value).length
        )
      )
  ) return "";

  // Handles variables.
  isVariable(name) && (options = {
    objSerializer: require("./serializeVariable"),
    createArray: true,
    forceArray: true,
    ...(options || {})
  })

  // Handles keywords.
  const keyword = getKeyword(name);
  if (keyword) {
    return `${keyword}\n${indent}${serializeField(null, value, indent, options)}`;
  }

  // Handles titles.
  if (isTitle(name)) {
    return `${name}\n${indent}${serializeField(null, value, indent, options)}`;
  }

  // Normalize input.
  const {
    serializeObject: _so,
    objSerializer = _so,
    createArray = false,
    forceArray = false
  } = options || {}

  // Value is plain text.
  if (typeof value !== "object") {
    return serializeText(name, value, indent, createArray);
  }

  // Value is an non-array object.
  if (!Array.isArray(value)) {
    if (objSerializer && objSerializer.VALUE_SERIALIZER) {
      return objSerializer(value, indent, options);
    }
    return (objSerializer && createObjectSerializer(objSerializer) || serializeObject)(name, value, indent, options);
  }

  // Value is an array of text.
  return serializeArray(name, value, indent, objSerializer, forceArray);
}

/**
 * @function normalizeNewlines
 * @description Normalizes newline sequences and strips trailing whitespace from each line.
 * Trims leading/trailing whitespace from the full string, collapses consecutive newlines
 * into a single blank line, and removes trailing spaces or tabs before each newline.
 *
 * @param {*} str - The value to normalize. Coerced to string via template literal.
 * @returns {string} The normalized string.
 *
 * @example
 * normalizeNewlines("Line 1\n   \nLine 2");
 * // → "Line 1\n\nLine 2"
 *
 * @example
 * normalizeNewlines("  hello  \n  world  ");
 * // → "hello\n  world"
 */
const normalizeNewlines = str => `${str}`.trim()
  .replace(/(\n|\r)(\n|\r)+/g, "\n\n")
  .replace(/[ \t]+(\n|$)/gm, "$1");

  /**
 * @function serializeText
 * @description Serializes a primitive value into a PPL formatted string.
 * Normalizes newlines, filters blank lines, then either produces an inline
 * `"name: value"`, an indented block, or an indexed array block.
 *
 * @param {string|null} name - Field label. If null or empty, no label is prepended.
 * @param {*} text - The primitive value to serialize. Coerced to string.
 * @param {string} indent - Indentation string for multi-line output.
 * @param {boolean} createArray - When true, multi-line output produces an indexed
 *   array block instead of an indented text block.
 *
 * @returns {string} The formatted string, or empty string if no non-blank lines exist.
 *
 * @example
 * serializeText("title", "Hello", "  ", false);
 * // → "title: Hello"
 *
 * @example
 * serializeText("note", "Line 1\nLine 2", "  ", false);
 * // → "note:\n  Line 1\n  Line 2"
 *
 * @example
 * serializeText("note", "Line 1\nLine 2", "  ", true);
 * // → "notes[2]:\n  - Line 1\n  - Line 2"
 *
 * @example
 * serializeText(null, "Hello", "  ", false);
 * // → "Hello"
 */
const serializeText = (name, text, indent, createArray) => {
  text = normalizeNewlines(text);
  const lines = getLines(text).filter(filterBlank);
  return lines.length === 1 && (
    name && `${name}: ${lines[0]}` || lines[0]
  ) || (
    lines.length && (
      createArray && (
        name && (
          text = lines.map(x => `${indent}- ${x}`),
           `${name}s[${text.length}]:\n${text.join("\n")}`
        ) || textIndent(text.join("\n"), indent, false)
      ) || (
        name && `${name}:\n${indentText(text, indent)}` || indentText(text, indent, false)
      )
    )
  ) || "";
}

/**
 * @function filterBlank
 * @private
 * @description Predicate that returns a truthy value for non-blank strings
 * and a falsy value for blank or whitespace-only strings.
 * Designed for use with `Array.prototype.filter`.
 *
 * @param {string} x - The string to test.
 * @returns {string} The trimmed string — truthy if non-empty, falsy if blank.
 *
 * @example
 * ["hello", "  ", "world", ""].filter(filterBlank);
 * // → ["hello", "world"]
 */
const filterBlank = x => x.trim();

/**
 * @function serializeArray
 * @description Serializes an array of values into a PPL formatted string.
 * Flattens nested arrays, serializes each item using `objSerializer` for objects
 * and `serializeText` for primitives, filters blanks, then either unwraps
 * single-item arrays or produces an indexed `"names[N]:"` block.
 *
 * @param {string} name - Field label used as the array block header base name.
 * @param {Array} arr - The array to serialize. Nested arrays are flattened.
 * @param {string} indent - Indentation string for item content.
 * @param {Function} [objSerializer=_serializeObject] - Serializer used for object
 *   items in the array. Defaults to `_serializeObject` for PPL key:value format.
 *   Pass any serializer with `FULL_SERIALIZER = true` (e.g. `serializeObject`)
 *   to use a pre-built named field serializer instead.
 *
 * @returns {string} The formatted array string, or empty string if no non-blank
 *   items remain after filtering.
 *
 * @example
 * serializeArray("tag", ["js", "node"], "  ");
 * // → "tags[2]:\n  - js\n  - node"
 *
 * @example
 * serializeArray("tag", ["js"], "  ");
 * // → "tag: js"
 *
 * @example
 * serializeArray("note", ["line 1\nline 2", "item 2"], "  ");
 * // → "notes[2]:\n  - line 1\n    line 2\n  - item 2"
 */
const serializeArray = (name, arr, indent, objSerializer = _serializeObject, forceArray = false) => {
  let hasObject = false;
  arr = arr.flat(Infinity).map(
    v => v && (
      typeof v === "object" && (hasObject = true) && objSerializer(v, indent)
      || serializeText(null, v, indent)
    ) || ""
  ).filter(filterBlank);
  let lines;
  return !(forceArray && hasObject) && arr.length === 1 && (
    arr = arr[0],
    lines = getLines(arr),
    lines.length === 1 && (name && `${name}: ${lines[0]}` || lines[0])
      || (name && `${name}:\n${indentText(arr, indent)}` || indentText(arr, indent, false))
  ) || (
    arr.length && (
      arr = arr.map(x => `${indent}- ${indentText(x, indent + "  ", false)}`),
      name && `${name}s[${arr.length}]:\n${arr.join("\n")}` || arr.join("\n")
    )
  ) || "";
}

/**
 * @function createObjectSerializer
 * @description Factory that wraps a raw object serializer function into a named
 * PPL field serializer.
 *
 * Three cases:
 * - If `serializer.FULL_SERIALIZER === true`, the serializer is returned directly
 *   without wrapping — it already handles field naming and block formatting itself.
 *   The returned function also has `FULL_SERIALIZER = true` set on it.
 * - If `serializer === _serializeObject`, `hasNested` is `true` and output is
 *   always a block regardless of line count.
 * - For any other custom serializer returning a plain string, single-line output
 *   goes inline and multi-line output produces a block.
 *
 * The `FULL_SERIALIZER` flag allows pre-built serializers like `serializeVariable`
 * to pass through `createObjectSerializer` calls in the call chain without being
 * re-wrapped each time.
 *
 * @param {Function} serializer - The raw serializer. One of:
 *   - A function with `FULL_SERIALIZER = true` — returned as-is
 *   - `_serializeObject` — always block format
 *   - Any custom function returning a string — inline or block based on line count
 *
 * @returns {Function} A serializer with signature `(name, obj, indent, options) => string`
 *   and `FULL_SERIALIZER = true` set on the returned function.
 *
 * @example
 * // Default PPL serializer — always block
 * const s = createObjectSerializer(_serializeObject);
 * s("meta", { version: 1 }, "  ");
 * // → "meta:\n  version: 1"
 *
 * @example
 * // FULL_SERIALIZER — returned as-is
 * const s = createObjectSerializer(serializeObject); // serializeObject.FULL_SERIALIZER = true
 * s === serializeObject; // → true
 *
 * @example
 * // Custom serializer returning scalar — inline
 * const s = createObjectSerializer(o => o.key);
 * s("data", { key: "value" }, "  ");
 * // → "data: value"
 */
const createObjectSerializer = serializer => {
  const out = serializer.FULL_SERIALIZER && serializer || ((name, obj, indent, options) => {
    const hasNested = serializer === _serializeObject;
    obj = serializer(obj, indent, options);
    obj = normalizeNewlines(obj);
    const lines = getLines(obj).filter(filterBlank);
    return lines.length === 1 && !hasNested && (
      name && `${name}: ${lines[0]}` || lines[0]
    ) || (
      (hasNested || lines.length) && (name && `${name}:\n${indentText(obj, indent)}` || indentText(obj, indent, false))
    ) || "";
  });
  try {
    out.FULL_SERIALIZER = true;
  } catch {}
  return out;
};

/**
 * @function _serializeObject
 * @private
 * @description Internal default object serializer. Iterates all enumerable keys
 * of an object and recursively serializes each key-value pair via `serializeField`
 * with `createArray: true`. Passes itself as `serializeObject` option so nested
 * objects also use PPL format. Returns a plain string.
 *
 * @param {Object} obj - The object to serialize.
 * @param {string} [indent="  "] - Indentation string for nested content.
 * @param {Object} [options={}] - Options passed through to `serializeField`.
 *
 * @returns {string} Serialized PPL key:value string.
 *
 * @example
 * _serializeObject({ name: "string", age: "number" }, "  ");
 * // → "name: string\nage: number"
 *
 * @example
 * _serializeObject({ user: { name: "string" } }, "  ");
 * // → "user:\n  name: string"
 */
const _serializeObject = (obj, indent = "  ", options) => {
  const out = [];
  
  for (const k in obj) {
    const v = obj[k];
    const field = serializeField(k, v, indent, {
      createArray: true,
      serializeObject: _serializeObject,
      ...(options || {})
    });
    field && out.push(field);
  }

  return out.filter(filterBlank).join("\n");
};

/**
 * @constant {Function} serializeObject
 * @description Default PPL object field serializer, created by wrapping
 * `_serializeObject` with `createObjectSerializer`. Always produces block format.
 *
 * @example
 * serializeObject("schema", { id: "string", content: "string" }, "  ");
 * // → "schema:\n  id: string\n  content: string"
 */
const serializeObject = createObjectSerializer(_serializeObject);

/**
 * @ignore
 * Default export with freezing.
 */
serializeField.normalizeNewlines = normalizeNewlines;
serializeField.serializeText = serializeText;
serializeField.serializeArray = serializeArray;
serializeField.createObjectSerializer = createObjectSerializer;
serializeField.serializeObject = serializeObject;
module.exports = Object.freeze(Object.defineProperty(serializeField, "serializeField", {
  value: serializeField
}));