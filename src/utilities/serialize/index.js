/**
 * @file index.js
 * @brief Top-level serializer that composes USER INPUTS, TO ACHIEVE, and RESULTS
 * sections into a complete PPL document string.
 */

"use strict";

const serializeVariable = require("./serializeVariable");
const serializeBlock = require("./serializeBlock");
const serializeField = require("./serializeField");
const indentText = require("./indentText");
const { normalizeTitle } = require("./normalizeUtils");


/**
 * @function serialize
 * @description Serializes a structured prompt object into a complete PPL document
 * string with USER INPUTS, TO ACHIEVE, and RESULTS sections separated by `---`.
 *
 * The input object supports the following field aliases:
 * - `input` / `inputs` — user input variables (optional)
 * - `toAchieve` / `task` / `tasks` / `goal` / `goals` — goals to accomplish (required)
 * - `output` / `outputs` — output variables (required)
 *
 * At least one valid output and one valid goal must be provided, otherwise an
 * error is thrown. Inputs are optional — if absent, the USER INPUTS section
 * is omitted from the output.
 *
 * @param {Object} obj - The structured prompt object to serialize.
 * @param {string|Array|Object} [obj.inputs] - User input variables. Accepts a
 *   single variable, an array of variables, or a flat-mappable structure.
 *   Aliases: `input`.
 * @param {string|Array|Object} obj.goals - Goals to accomplish. Required.
 *   Aliases: `toAchieve`, `task`, `tasks`, `goal`.
 * @param {string|Array|Object} obj.outputs - Output variables. Required.
 *   Aliases: `output`.
 * @param {Object} [options={}] - Serialization options.
 * @param {string} [options.indent="  "] - Indentation string for nested content.
 * @param {string} [options.sep="\n\n---\n\n"] - Section separator string.
 *
 * @throws {Error} If `obj` is not a plain object or is an array.
 * @throws {Error} If no outputs are specified.
 * @throws {Error} If no valid outputs are produced after serialization.
 * @throws {Error} If no valid goals are produced after serialization.
 *
 * @returns {string} The complete PPL document string.
 *
 * @example
 * // Minimal example
 * serialize({
 *   inputs: [{ name: "question", description: "user question", format: "text" }],
 *   goals: [{
 *     name: "answer_from_kb",
 *     type: "GOAL",
 *     role: "research assistant",
 *     inputs: ["$question"],
 *     outputs: ["$answer"],
 *     steps: [{ name: "search", type: "STEP", do: ["retrieve top k"] }]
 *   }],
 *   outputs: [{ name: "answer", description: "final answer", format: "markdown" }]
 * });
 * // → "USER INPUTS\n  # What the users pass in\n  inputs[1]:\n..."
 * //   + "\n\n---\n\n"
 * //   + "TO ACHIEVE\n  # What to accomplish for the user\n  goals[1]:\n..."
 * //   + "\n\n---\n\n"
 * //   + "RESULTS\n  # What the user gets back\n  outputs[1]:\n..."
 *
 * @example
 * // Custom indent and separator
 * serialize(obj, { indent: "    ", sep: "\n---\n" });
 *
 * @example
 * // No inputs — USER INPUTS section omitted
 * serialize({ goals: [...], outputs: [...] });
 *
 * @see {@link serializeVariable} for variable serialization
 * @see {@link serializeBlock} for block/goal serialization
 * @see {@link indentText} for indentation behavior
 */
const serialize = (obj, options) => {
  if (!(obj && typeof obj === "object") || Array.isArray(obj)) {
    throw Error(`Invalid input object to the serializer: ${obj}`);
  }

  const {
    user_input,
    user_inputs = user_input,
    userInput = user_inputs,
    userInputs = userInput,
    input = userInputs,
    inputs = input,
    mission,
    to_achieve = mission,
    toAchieve = to_achieve,
    task = toAchieve,
    tasks = task,
    goal = tasks,
    goals = goal,
    result: _result,
    results = _result,
    output = results,
    outputs = output,
    ...other
  } = obj;
  let {
    indent,
    sep
  } = options || {};
  indent || (indent = "  ");
  sep || (sep = "\n\n---\n\n");

  if (!outputs) {
    throw Error(`At least one output must be specified: ${outputs}`);
  }

  // Get outputs.
  const _outputs = serializeBlock({
    title: "RESULTS",
    comments: "What the user gets back",
    outputs: toArray(outputs)
  }, indent);

  if (!_outputs) {
    throw Error(`At least one valid output must be specified:${
      typeof outputs === "object" && `\n${JSON.stringify(outputs, null, 2)}` || ` ${outputs}`
    }`);
  }

  // Get goals.
  const _goals = serializeBlock({
    title: "TO ACHIEVE",
    comments: "What to accomplish for the user",
    goals: toArray(goals)
  }, indent);

  if (!_goals) {
    throw Error(`At least one valid goal must be specified:${
      typeof goals === "object" && `\n${JSON.stringify(goals, null, 2)}` || ` ${goals}`
    }`);
  }

  // Get inputs.
  let _inputs;
  try {
    inputs && (_inputs = serializeBlock({
      title: "USER INPUTS",
      comments: "What the user passes in",
      inputs: toArray(inputs)
    }, indent));
  } catch {}

  // Get other blocks.
  let _other = [];
  for (const k in other) {
    try {
      const res = serializeField(normalizeTitle(k), other[k], indent);
      res && _other.push(res);
    } catch {}
  }

  // Init results.
  const result = [];

  // Add sections.
  _inputs && result.push(_inputs);
  result.push(_goals);
  result.push(..._other);
  result.push(_outputs);

  return result.join(sep);
}

/**
 * @function toArray
 * @private
 * @description Ensures the input is returned as an array.
 * 
 * This utility function normalizes a value into an array format based on the following logic:
 * 1. If the input is falsy (null, undefined, etc.), it returns an empty array [].
 * 2. If the input is already an array, it returns the input as-is.
 * 3. If the input is any other truthy value, it wraps it in a new array.
 * 
 * @param {*} x The value to be converted or wrapped.
 * 
 * @return {Array} An array representation of the input.
 * 
 * @example
 * toArray(null);      // Returns []
 * toArray([1, 2]);   // Returns [1, 2]
 * toArray('hello');  // Returns ['hello']
 */
const toArray = x => !x && [] || (Array.isArray(x) && x) || [x];

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(serialize, "serialize", {
  value: serialize
}));