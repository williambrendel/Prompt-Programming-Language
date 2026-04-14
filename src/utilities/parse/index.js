"use strict";

const getLines = require("../geLines");

const parse = ppl => {
  // Init.
  const obj = {}, stack = [];

  // Get lines.
  const lines = getLines(ppl || "");

  // parse each line.
  for (let i = 0, l = lines.length, line, indent, refIndent = 0, trimmed; i !== l; ++i) {
    // Get line, and trimmed line, and current indent.
    line = lines[i];
    trimmed = line.trimStart();
    indent = line.length - trimmed.length;

    // Parse line.
  }

  return obj;
}

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(parse, "parse", {
  value: parse
}));