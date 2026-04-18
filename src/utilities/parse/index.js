"use strict";

const getLines = require("../geLines");
const { isTitle, isBaseKeyword, isEndKeyword, isBlock } = require("../nameUtils");
const tokenizeLines = require("./tokenizeLines");

/**
 * @function parse
 * @description Parses a PPL document string into a structured object.
 *
 * Uses an indent-based stack to traverse the document tree. Each line is
 * classified by its first character(s) and pushed onto, popped from, or
 * agglomerated into the current stack frame based on its indentation level.
 * `parent` tracks the last item on the stack for easy access.
 *
 * Line types handled (in order):
 *   - ` ``` `        code fence — raw content accumulated until closing fence,
 *                    JSON-parsed on close; format inferred from fence suffix
 *   - `#`            comment — attached to current node as `comments`
 *   - `- `           array child — child of current frame marked as list item
 *   - END* keyword   ignored — indentation already normalized by tokenizer
 *   - base keyword   control-flow keyword — new collecting frame keyed by keyword
 *   - title          all-uppercase string — generic collecting frame
 *   - block          `TYPE @name:` — new node frame `{ name, type }`
 *   - `key:`         variable or field definition — new collecting frame
 *   - `key: value`   inline scalar — set directly on current node
 *   - blank / `---`  separator sentinel — signals array boundary in current frame
 *   - free text      accumulated in `textBuf`, flushed to `description` on pop
 *                    if `description` does not exists
 *
 * @param {string} ppl - The raw PPL document string.
 * @returns {Object} The parsed document object.
 *
 * @example
 * parse(pplString);
 * // → { user_inputs: [...], to_achieve: [...], results: [...] }
 */
const parse = ppl => {
  // Init.
  const obj = {}, root = { level: -Infinity }, stack = [root];

  // Get lines.
  const lines = tokenizeLines(getLines(ppl || ""));

  // parse each line.
  // "parent" is the last item on the stack, for easy access, and is updated on push and pops.
  for (let i = 0, l = lines.length, parent = obj, lastKey = "textBuf", fence; i !== l; ++i) {
    // Get trimmed line, current indent and level.
    const {
      value,
      trimmed = value,
      line = trimmed,
      level
    } = lines[i];

    // Parse line.
    // Start with first character.
    const c = line.charCodeAt(0);

    // It's a fence, starting with ```.
    if (c === 96 && line.charCodeAt(1) == 96 && line.charCodeAt(2) === 96) {
      if (fence) {
        // Push fence.content and adjust format based on fence.format.
        // Push fence.content
        if (parent._lastKey) {
          parent[parent._lastKey] = fence.content;
          delete parent._lastKey;
        } else {
          parent.schema = fence.content;
        }

        // Prefill parent format key.
        parent.format || (parent.format = fence.format);

        // Reset fence.
        fence = null;
      } else {
        // Open fence.
        fence = {
          format: line.slice(3).toLowerCase(),
          content: "",
          level
        };
      }
      continue;
    }

    // It's a content inside the fence.
    if (fence) {
      fence.content += `${fence.content && "\n" || ""}${" ".repeat(level - fence.level)}${line}`;
      continue;
    }

    // Adjust stack based on indentation level
    if (level < stack.length) {
      // Flush description to the parent if needed.

      // Pop stack.
      while (level < stack.length) parent = stack.pop();
      parent || (parent = obj);
    }

    // It's a comment, starting with #
    if (c === 35) {
      (parent.comments || (parent.comments = [])).push(line);
      continue;
    }
    
    // It's an array's child, starting with -.
    if (c === 45) {
      
      continue;
    }
    
    // It's a keyword (DO, NEXT, IF, etc) or a title (SUPER AWESOME TITLE).
    // "End*" key words can be ignored, they just signify the end of a logic or loop block.
    if (isTitle(line)) {
      // It's an "END*" keyword --> ignore. Indentation already taken care of by tokenizer.
      if (isEndKeyword(line)) continue;

      // It's a base keyword, i.e. a keyword not starting with END.
      if (isBaseKeyword(line)) {

        continue;
      }

      // It's a title.

      continue;
    }

    // It's a block (TYPE @block_name:)
    if (isBlock(line)) {

      continue;
    }

    // It's a variable, starting potentially with $ ($var: or var:).
    // The value of the variable is in the next line and should be indented
    if (line.charCodeAt(line.length - 1) === 58) {
      
      continue;
    }

    // It's a variable with ($)key: value on the same line.
    let [key, val, ...other] = line.split(":");
    if (key && val && VAR_RE.test(key)) {
      other.length && (val += `:${other.join(":")}`);
      
      continue;
    }

    // It's a blank line or a separator line.
    // Either way it's used to separate sections and sub-sections and blocks
    // content separation with blank line or --- within the same level indicates
    // that the parent is an array.
    if (!line || SEP_RE.test(line)) {

      continue;
    }

    // It's free text, to be added under parents's textBuf[].
    // If at the end the parent key "description" is empty,
    // the textBuf array is joined with newline \n and migrated
    // under "description".

  }

  return obj;
}

/**
 * @constant {RegExp} VAR_RE
 * @private
 * @description Regular expression used to test if strings is a variable.
 */
const VAR_RE = /^(\$|)[\_\-a-z0-9]+(\s+|)$/;

/**
 * @constant {RegExp} SEP_RE
 * @private
 * @description Regular expression used to test if strings is a section separator.
 */
const SEP_RE = /^\-+(\s+|)$/;

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(parse, "parse", {
  value: parse
}));