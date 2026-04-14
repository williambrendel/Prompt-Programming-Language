"use strict";

const { normalizeBlockName, normalizeTitle } = require("./normalizeUtils");
const { serializeField, serializeText } = require("./serializeField");
const serializeVariable = require("./serializeVariable");
const indentText = require("./indentText");

/**
 * @function serializeBlock
 * @description Recursively serializes a block definition — or a primitive, array
 * of blocks, or nested block tree — into a formatted PPL string.
 *
 * Behavior by input type:
 * - **null / undefined / ""** — returns empty string.
 * - **Primitive (non-object)** — stringified and indented via `indentText`.
 * - **Array** — each item serialized recursively and joined with double newlines.
 * - **Object** — destructured and serialized as a named PPL block with type
 *   header, metadata fields, optional sub-blocks, and optional NEXT routing.
 *
 * Field aliases supported on block objects:
 * - `comment` / `comments` — optional comment rendered with `#` prefix
 * - `role` / `roles`
 * - `in` / `input` / `inputs` — serialized via `serializeVariable` when object
 * - `out` / `output` / `outputs` — serialized via `serializeVariable` when object
 * - `origin` / `provenance`
 * - `condition` / `conditions`
 * - `constraint` / `constraints`
 * - `goal` / `goals` / `step` / `steps` / `substep` / `substeps` / `children`
 *
 * Naming: a block may use either `name` + `type`, or `title` alone:
 * - `name` + `type` — produces `"TYPE @name:\n..."` header
 * - `title` — normalized via `normalizeTitle` and rendered as-is without type
 *   prefix or colon. Blocks with only `title` pass `isBlock` and are valid
 *   as sub-block children.
 *
 * Type inference when `type` is absent and `title` is also absent:
 * - Block with `substeps` → `"STEP"`
 * - Block with `steps` → `"GOAL"`
 * - Otherwise → throws
 *
 * Serialized field order:
 * 1. `comment` / `comments` — rendered as `# comment` before all other fields
 * 2. `role` / `roles`
 * 3. `input` / `inputs`
 * 4. `output` / `outputs`
 * 5. `description`
 * 6. `provenance`
 * 7. `constraints`
 * 8. `conditions`
 * 9. `DO` — keyword block, always `DO\n{indent}content`, never `DO:` or `DOs[N]:`
 * 10. sub-blocks (`steps[N]` for GOAL, `substeps[N]` for STEP/inferred)
 * 11. `NEXT` — keyword block, always `NEXT\n{indent}content`, never `NEXT:` or `NEXTs[N]:`
 *
 * DO and NEXT accept any value type (string, array, object) and always emit
 * as an indented keyword block regardless of content shape.
 *
 * @param {string|Object|Array} block - The block to serialize. Accepts a
 *   primitive, a block object, or an array of blocks.
 * @param {string} indent - Indentation string for one level of nesting (e.g. `"  "`).
 * @param {string} [curIndent=""] - Current absolute indentation prefix for this
 *   block's header line. Applied to both the header and all meta content via
 *   `indentText(meta.join("\n"), curIndent)`. Populated automatically during
 *   recursive calls for nested blocks.
 *
 * @throws {Error} If a block object has neither `name` nor `title`.
 * @throws {Error} If a block object has neither `type` nor `title` and type
 *   cannot be inferred from `steps` or `substeps`.
 * @throws {Error} If a block object has both `do` and sub-blocks — mutually exclusive.
 * @throws {Error} If a block object produces empty content after serialization
 *   (excluding a comments-only block).
 *
 * @returns {string} The fully serialized PPL block string, or empty string for
 *   null / undefined / empty input.
 *
 * @example
 * // Primitive — indented text
 * serializeBlock("tokenize $question", "  ");
 * // → "tokenize $question"
 *
 * @example
 * // Leaf SUBSTEP with DO as string
 * serializeBlock({
 *   name: "embed",
 *   type: "SUBSTEP",
 *   inputs: ["$question"],
 *   outputs: ["$embedded"],
 *   do: "tokenize $question\nproject into vector space"
 * }, "  ");
 * // → "SUBSTEP @embed:\n  input: $question\n  output: $embedded\n  DO\n    tokenize $question\n    project into vector space"
 *
 * @example
 * // Leaf SUBSTEP with DO as array
 * serializeBlock({
 *   name: "embed",
 *   type: "SUBSTEP",
 *   do: ["tokenize $question", "project into vector space"]
 * }, "  ");
 * // → "SUBSTEP @embed:\n  DO\n    - tokenize $question\n    - project into vector space"
 *
 * @example
 * // STEP with NEXT routing
 * serializeBlock({
 *   name: "check_relevance",
 *   type: "STEP",
 *   inputs: ["$results"],
 *   outputs: ["$score"],
 *   do: ["score results"],
 *   next: "IF $score >= 0.7 THEN GOTO @generate\nELSE GOTO @fallback"
 * }, "  ");
 * // → "STEP @check_relevance:\n  ...\n  DO\n    score results\n  NEXT\n    IF $score >= 0.7 THEN GOTO @generate\n    ELSE GOTO @fallback"
 *
 * @example
 * // Block with comment
 * serializeBlock({
 *   name: "embed",
 *   type: "SUBSTEP",
 *   comment: "embeds the user question into vector space",
 *   do: ["tokenize $question"]
 * }, "  ");
 * // → "SUBSTEP @embed:\n  # embeds the user question into vector space\n  DO\n    ..."
 *
 * @example
 * // Block with title — no type prefix emitted
 * serializeBlock({
 *   title: "user inputs",
 *   description: "variables passed in by the user"
 * }, "  ");
 * // → "USER INPUTS\n  description: variables passed in by the user"
 *
 * @example
 * // GOAL with nested STEPs — type inferred from steps array
 * serializeBlock({
 *   name: "answer_from_kb",
 *   role: "research assistant",
 *   inputs: ["$question"],
 *   outputs: ["$answer"],
 *   steps: [
 *     { name: "embed",     type: "STEP", do: ["embed $question"] },
 *     { name: "search_kb", type: "STEP", do: ["retrieve top k"] }
 *   ]
 * }, "  ");
 * // → "GOAL @answer_from_kb:\n  role: research assistant\n  ...\n  steps[2]:\n  - STEP @embed:\n  ..."
 *
 * @example
 * // Array of blocks — joined with double newlines
 * serializeBlock([blockA, blockB], "  ");
 * // → "<blockA output>\n\n<blockB output>"
 *
 * @see {@link normalizeUtils} for block name and title normalization
 * @see {@link serializeField} for field serialization
 * @see {@link serializeVariable} for variable object serialization
 * @see {@link indentText} for indentation behavior
 */
const serializeBlock = (block, indent, curIndent = "") => {
  if (block === null || block === undefined || block === "") return "";

  if (typeof block !== "object") {
    return indentText(`${block}`, curIndent);
  }

  if (Array.isArray(block)) {
    return block.map(b => serializeBlock(b, indent, curIndent)).join("\n\n");
  }

  // Normalize input.
  let {
    name,
    title,
    type,
    role,
    roles = role,
    comment,
    comments = comment,
    description,
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
    step,
    steps = step,
    substep,
    substeps = substep,
    children = substeps || steps || goals
  } = block || {}, subBlocks = (Array.isArray(children) && children || (
    children && [children] || []
  )).filter(isBlock);

  title && (title = normalizeTitle(title));
  name && (name = normalizeBlockName(name));
  
  type = type && type.toUpperCase() || (
    substeps && "STEP"
  ) || (
    steps && "GOAL"
  );

  if (!(name || title)) {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\nis missing name`);
  }

  if (!(type || title)) {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\nis missing type`);
  }

  if (_do && subBlocks.length) {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\ncannot have both a do and a sub-block`);
  }

  // Serialize.
  let meta = [];

  // Serialize, indent, and add comments.
  comments && (comments = serializeText("", comments, "# ", false)) && (
    meta.push(indentText("# " + comments, indent))
  );

  // Serialize, indent, and add roles.
  (roles = serializeField("role", roles, indent, { createArray: true })) && (
    meta.push(indentText(roles, indent))
  );

  // Serialize, indent, and add inputs.
  (inputs = serializeField("input", inputs, indent)) && (
    meta.push(indentText(inputs, indent))
  );

  // Serialize, indent, and add inputs.
  (outputs = serializeField("output", outputs, indent)) && (
    meta.push(indentText(outputs, indent))
  );

  // Serialize, indent, and add description.
  (description = serializeField("description", description, indent)) && (
    meta.push(indentText(description, indent))
  );

  // Serialize, indent, and add Provenance.
  provenance && meta.push(`${indent}provenance: ${provenance}`);

  // Serialize, indent, and add constraints.
  (constraints = serializeField("constraint", constraints, indent, { createArray: true })) && (
    meta.push(indentText(constraints, indent))
  );

  // Serialize, indent, and add conditions.
  (conditions = serializeField("condition", conditions, indent, { createArray: true })) && (
    meta.push(indentText(conditions, indent))
  );
  
  // Serialize, indent, and add DO.
  (_do = serializeField("DO", _do, indent)) && (
    meta.push(indentText(_do, indent))
    // meta.push(indentText(_do, indent).replace(/DO([^\:]+|)\:\s*(\n|)/, `DO\n${indent + indent}`))
  );

  subBlocks = subBlocks.map(b => serializeBlock(b, indent)).filter(x => x);
  let childrenLabel = substeps && "substep" || steps && "step" || goals && "goal" || "task";
  subBlocks.length && (
    meta.push(
      indentText(
        `${childrenLabel}s[${subBlocks.length}]:\n${subBlocks.map(b => `${indent}- ${indentText(b, indent + "  ", false)}`).join("\n")}`,
        indent
      )
    )
  );

  // Serialize, indent, and add NEXT.
  (next = serializeField("NEXT", next, indent)) && (
    meta.push(indentText(next, indent))
    // meta.push(indentText(next, indent).replace(/NEXT([^\:]+|)\:\s*(\n|)/, `NEXT\n${indent + indent}`))
  );

  if (comments && meta.length === 1 || !meta.length ) {
    throw Error(`Block:\n${JSON.stringify(block, null, 2)}\n has empty content`);
  }

  return `${curIndent}${title || `${type} ${name}:`}\n${indentText(meta.join("\n"), curIndent)}`;
}

/**
 * @function isBlock
 * @description Determines whether a value is a valid serializable block object.
 * A valid block must be a non-null object with at least a `name` + `type` pair,
 * or a `name` + `type` pair implied by child arrays (`steps` / `substeps`).
 * Note: blocks with only a `title` field are valid for serialization but will
 * NOT pass this predicate — they are excluded from sub-block filtering.
 *
 * @param {*} b - The value to test.
 * @returns {boolean} True if the value is a valid block object.
 *
 * @example
 * isBlock({ name: "embed", type: "STEP" });    // → true
 * isBlock({ name: "embed" });                  // → false — missing type
 * isBlock({ title: "MY BLOCK" });              // → true — title alone sufficient
 * isBlock("embed");                            // → false — not an object
 * isBlock(null);                               // → false
 */
const isBlock = b => b && typeof b === "object" && (b.name && b.type || b.title);


/**
 * @ignore
 * Default export with freezing.
 */
serializeBlock.isBlock = isBlock;
module.exports = Object.freeze(Object.defineProperty(serializeBlock, "serializeBlock", {
  value: serializeBlock
}));