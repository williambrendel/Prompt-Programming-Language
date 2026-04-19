/**
 * @file index.js
 * @brief Top-level serializer that composes USER INPUTS, TO ACHIEVE, and RESULTS
 * sections into a complete PPL document string.
 */

"use strict";

const { isKeyword, isTitle } = require("../nameUtils");
const indentText = require("./indentText");
const { normalizeVariableName, normalizeBlockName, normalizeKeyword } = require("./normalizeUtils");

/**
 * @function serialize
 * @description Recursively serializes a PPL block object into a formatted
 * PPL document string.
 *
 * Behavior by input type:
 * - **falsy**          — returns empty string.
 * - **primitive**      — stringified and trimmed. `true` serializes to `"true"`.
 *                        Multi-line values are re-indented; single-line returned as-is.
 * - **array**          — each item serialized recursively and joined with
 *                        `"- "` list prefix.
 * - **object**         — destructured into known fields and serialized in
 *                        canonical PPL field order (see below).
 *
 * Known fields (serialized in this order):
 *   `comments`, `role`, `inputs`, `outputs`, `description`, `format`,
 *   `schema`, `provenance`, `constraints`, `required`, `conditions`,
 *   unknown keys (via `other`), `do`, child blocks, `next`
 *
 * Unknown keys in `other` are serialized as keyword fields if they are
 * recognized keywords or titles (`isKeyword` / `isTitle`), otherwise as
 * standard fields.
 *
 * Child block types supported (mutually exclusive):
 *   `goals`, `subgoals`, `steps`, `substeps`, `tasks`, `subtasks`
 *
 * Root-level validation (when `options.root === true`):
 *   - Must define `outputs`
 *   - Must define at least one child block
 *   - A block cannot have both `do` and child blocks
 *
 * Sections are joined with `"\n\n"` at root level and `"\n"`
 * for all nested blocks.
 *
 * @param {*}      block            - The value to serialize.
 * @param {Object} [options]        - Serialization options.
 * @param {string} [options.prefix=""]    - Prefix prepended to each field (e.g. `"$"`, `"STEP @"`).
 * @param {string} [options.indent="  "]  - Indentation string for one level of nesting.
 * @param {boolean} [options.newline]     - Whether to prepend a newline to multi-line literals.
 * @param {boolean} [options.root=true]   - Whether this is the root call.
 *
 * @throws {Error} If a child block type field contains a non-object value.
 * @throws {Error} If multiple child block type fields are defined simultaneously.
 * @throws {Error} If root is true and `outputs` is missing.
 * @throws {Error} If root is true and no child blocks are defined.
 * @throws {Error} If both `do` and child blocks are defined on the same block.
 *
 * @returns {string} The serialized PPL string.
 *
 * @example
 * serialize({ goals: [...], outputs: [...] });
 * // → "GOALS\n  ...\n\nOUTPUTS\n  ..."
 *
 * @example
 * // Custom indent, non-root
 * serialize(block, { indent: "    ", root: false });
 */
const serialize = (block, options) => {
  // Get options.
  let {
    prefix,
    indent,
    newline,
    root
  } = options || (options = {});
  prefix || (prefix = "");
  indent === undefined && (indent = "  ");
  root === undefined && (root = true);
  options = { ...options, indent, prefix: "", root: false };

  // Input is nothing.
  if (!block) return "";

  // Input is a litteral.
  if (typeof block !== "object") {
    prefix === "$" && (block = normalizeVariableName(block));
    return NEWLINE_TEST_RE.test(block = `${block}`.trim())
    && `${newline && `\n${indent}` || ""}${prefix}${block.replace(NEWLINE_REPLACE_RE, `\n${indent}`)}`
    || `${prefix}${block}`;
  }

  // Input is an array.
  if (Array.isArray(block)) {
    const out = block.map(item => serialize(item, {
      ...options,
      prefix,
      newline: false,
      indent: "  "
    })).join(`${indent}\n- `);
    return block.length > 1 && indentText(`- ${out}`, indent) || out;
  }

  // Set default new line for subsequent values.
  newline === undefined && (newline = options.newline = true);

  // Input is a real object.
  let {
    role,
    roles = role,
    comment,
    comments = comment,
    description,
    descriptions = description,
    origin,
    provenance = origin,
    condition,
    conditions = condition,
    constraint,
    constraints = constraint,
    in: _in,
    input = _in,
    inputs = input,
    out,
    output = out,
    outputs = output,
    do: _do,
    next,
    goal,
    goals = goal,
    subgoal,
    subgoals = subgoal,
    step,
    steps = step,
    substep,
    substeps = substep,
    task,
    tasks = task,
    subtask,
    subtasks = subtask,
    format,
    required,
    schema,
    ...other
  } = block,
  children = subtasks || tasks || substeps || steps || subgoal || goals,
  childType = children && (
    children === subtasks && "SUBTASK"
    || (children === tasks && "TASK")
    || (children === substeps && "SUBSTEP")
    || (children === steps && "STEP")
    || (children === subgoals && "SUBGOAL")
    || (children === goals && "GOAL")
  );

  if (children && typeof children !== "object") {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot have a non object ${childType}S`);
  }

  if (goals && childType !== "GOAL") {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot define both GOALS and ${childType}S at the same time`);
  }

  if (subgoals && childType !== "SUBGOAL") {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot define both SUBGOALS and ${childType}S at the same time`);
  }

  if (steps && childType !== "STEP") {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot define both STEPS and ${childType}S at the same time`);
  }

  if (substeps && childType !== "SUBSTEP") {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot define both SUBSTEPS and ${childType}S at the same time`);
  }

  if (tasks && childType !== "TASK") {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot define both TASKS and ${childType}S at the same time`);
  }

  if (subtasks && childType !== "SUBTASK") {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot define both SUBTASKS and ${childType}S at the same time`);
  }

  if (root && !outputs) {
    throw Error("PPL document must define OUTPUT");
  }

  const numChildren = children && Object.values(children).filter(v => v !== null && v !== undefined).length || 0;
  if (_do && numChildren) {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot have both a do and a sub-block`);
  }

  if (root && !numChildren) {
    throw Error("PPL document must define GOALS");
  }

  // Serialize.
  let serialized = [];

  // Serialize comments.
  comments && (
    Array.isArray(comments) && (comments = comments.join("\n"))
    || (typeof comment === "object" && (comments = JSON.stringify(comments, null, 2))),
    (comments = `${comments}`.trim())
    && serialized.push(`# ${comments}`.replace(NEWLINE_REPLACE_RE, "\n #"))
  );

  // Serialize roles.
  serializeField("role", roles, options, root, serialized);

  // Serialize inputs.
  serializeKeywordField("INPUT", inputs, { ...options, childrenPrefix: "$" }, root, serialized);

  // Serialize outputs.
  serializeKeywordField("OUTPUT", outputs, { ...options, childrenPrefix: "$" }, root, serialized);

  // Serialize description.
  serializeField("description", descriptions, options, root, serialized);

  // Serialize format.
  serializeField("format", format && (format = format.toLowerCase()), options, root, serialized);

  // Serialize schema.
  schema && (
    schema = typeof schema === "object" && JSON.stringify(schema, null, indent) || `${schema}`,
    schema = "|" + indentText(`\n${schema}`, indent),
    serialized.push(indentText(`schema: ${schema}`, !root && indent))
  );
  
  // Serialize provenance.
  serializeField("provenance", provenance, options, root, serialized);

  // Serialize constraints.
  serializeField("constraints", constraints, options, root, serialized);

  // Serialize required.
  serializeField("required", required, options, root, serialized);

  // Serialize condition.
  serializeField("conditions", conditions, options, root, serialized);
  
  // Serialize other stuff.
  for (const k in other) {
    // normalizeKeyword(key)
    (isKeyword(k) || isTitle(k)) && serializeKeywordField(normalizeKeyword(k), other[k], { ...options, prefix }, root, serialized)
    || serializeField(k, other[k], { ...options, prefix }, root, serialized);
  }

  // Serialize DO.
  serializeKeywordField("DO", _do, options, root, serialized);

  // Serialize steps.
  numChildren && serializeKeywordField(`${childType}S`, children, { ...options, childrenPrefix: `${childType} @` }, root, serialized);

  // Serialize NEXT.
  serializeKeywordField("NEXT", next, options, root, serialized);

  return serialized.join("\n");
}

/**
 * @constant {RegExp} NEWLINE_TEST_RE
 * @private
 * @description Tests whether a string contains any newline sequence.
 * Handles all common newline encodings: `\n` (Unix/macOS), `\r\n` (Windows),
 * and `\r` (legacy Mac). No `g` flag — stateless, safe for repeated `test()` calls.
 *
 * @example
 * NEWLINE_TEST_RE.test("line1\nline2"); // → true
 * NEWLINE_TEST_RE.test("single line"); // → false
 */
const NEWLINE_TEST_RE = /\r?\n|\r/;

/**
 * @constant {RegExp} NEWLINE_REPLACE_RE
 * @private
 * @description Matches all newline sequences in a string for replacement.
 * Handles all common newline encodings: `\n` (Unix/macOS), `\r\n` (Windows),
 * and `\r` (legacy Mac). The `g` flag ensures all occurrences are replaced in
 * a single `replace()` call, used to re-indent multi-line values during serialization.
 *
 * @example
 * "line1\nline2".replace(NEWLINE_REPLACE_RE, "\n  "); // → "line1\n  line2"
 */
const NEWLINE_REPLACE_RE = /\r?\n|\r/g;

/**
 * @function serializeField
 * @private
 * 
 * @description Serializes a standard key-value field into the PPL output stream.
 *
 * This helper handles normalization and formatting of non-keyword fields.
 * It performs three responsibilities:
 *
 * 1) Normalize field names when required
 * 2) Recursively serialize nested values
 * 3) Append the formatted result to the serialized output buffer
 *
 * Field normalization depends on context:
 *
 * - Variable context ("$" prefix):
 *     normalizeVariableName()
 *
 * - Block context ("@" prefix):
 *     normalizeBlockName()
 *
 * - Default context:
 *     field name is preserved
 *
 * @param {string} key
 * The field name to serialize.
 *
 * @param {*} val
 * The field value. May be:
 * - primitive
 * - object
 * - array
 *
 * @param {Object} options
 * Serialization configuration, including:
 *
 * - indent
 * - prefix
 * - newline behavior
 * - root state
 *
 * @param {string[]} serialized
 * Mutable buffer that accumulates serialized output lines.
 *
 * @behavior
 * The field is serialized only if the value is truthy.
 *
 * Nested objects are serialized recursively using the same serializer.
 *
 * @example
 * Input:
 *   key = "description"
 *   val = "Normalize text"
 *
 * Output line:
 *   description: Normalize text
 *
 * @example
 * Variable context:
 *   key = "user name"
 *
 * Output:
 *   $user_name: value
 *
 * @note
 * This function does not emit keywords. Keyword handling is delegated
 * to serializeKeywordField().
 */
const serializeField = (key, val, options, root, serialized, isObj) => (
  val && (
    isObj = typeof val === "object" && !Array.isArray(val),
    options.prefix === "$" && (
      serialized.length
        && serialized[serialized.length - 1].trim().charCodeAt(0) === 36
        && serialized.push(""),
      key = normalizeVariableName(key)
    ) || (options.prefix.charCodeAt(options.prefix.length - 1) === 64
      && (
        serialized.length && serialized.push(""),
        key = normalizeBlockName(key)
      )
    ) || (
      serialized.length
        && isTitle(serialized[serialized.length - 1].trim().split(" ")[0])
        && serialized.push("")
    ),
    val = serialize(val, options.childrenPrefix && {...options, childrenPrefix: "", prefix: options.childrenPrefix } || options),
    (isObj || (NEWLINE_TEST_RE.test(val) && val.charCodeAt(0) !== 10)) && (val = `\n${val}`) || val
  ) && serialized.push(
    options.prefix === "$" && val === true && indentText(`$${key}`, !root && options.indent)
    || indentText(`${options.prefix || ""}${key}:${val.charCodeAt(0) !== 10 && " " || ""}${val}`, !root && options.indent)
  )
);

/**
 * @function serializeKeywordField
 *
 * @description Serializes a PPL keyword section.
 *
 * This helper formats structural keywords such as:
 *
 * - INPUT
 * - OUTPUT
 * - DO
 * - NEXT
 * - STEPS
 * - GOALS
 *
 * Unlike serializeField(), keyword fields:
 *
 * - Do not use colon syntax
 * - Represent structural blocks
 * - May contain nested objects or lists
 *
 * The value is serialized recursively, then emitted using
 * the canonical PPL keyword format:
 *
 *     KEYWORD <serialized value>
 *
 * @param {string} key
 * The keyword name to emit.
 *
 * @param {*} val
 * The keyword value. May be:
 *
 * - object
 * - array
 * - primitive
 *
 * @param {Object} options
 * Serialization configuration.
 *
 * @param {string[]} serialized
 * Mutable buffer that accumulates serialized output lines.
 *
 * @behavior
 * The keyword is emitted only if the value is truthy and not strictly `true`.
 * A boolean `true` value is treated as a no-op to avoid emitting bare keywords
 * with no content.
 *
 * @example
 * Input:
 *   key = "INPUT"
 *   val = { text: "hello" }
 *
 * Output:
 *   INPUT
 *     $text: hello
 *
 * @example
 * Nested block:
 *   key = "STEP"
 *
 * Output:
 *   STEP @process_data
 *
 * @note
 * This function defines the canonical rendering of structural
 * sections in the PPL language.
 *
 * @note
 * Keyword serialization is separated from field serialization to:
 *
 * - enforce consistent grammar
 * - simplify validation
 * - support future keyword extensions
 */
const serializeKeywordField = (key, val, options, root, serialized, isObj) => (
  val && val !== true && (
    isObj = typeof val === "object" && !Array.isArray(val),
    val = serialize(val, options.childrenPrefix && {...options, childrenPrefix: "", prefix: options.childrenPrefix } || options),
    (isObj || (NEWLINE_TEST_RE.test(val) && val.charCodeAt(0) !== 10)) && (val = `\n${val}`) || val
  ) && (
    serialized.length && serialized.push(""),
    serialized.push(indentText(`${options.prefix || ""}${key}${val.charCodeAt(0) !== 10 && " " || ""}${val}`, !root && options.indent))
  )
);

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(serialize, "serialize", {
  value: serialize
}));