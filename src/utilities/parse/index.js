"use strict";

const getLines = require("../geLines");
const tokenizeLines = require("./tokenizeLines");

const parse = ppl => {
  // Init.
  const obj = {}, stack = [];

  // Get lines.
  const lines = tokenizeLines(getLines(ppl || ""));

  // parse each line.
  for (let i = 0, l = lines.length, refLevel = 0; i !== l; ++i) {
    // Get trimmed line, current indent and level.
    const {
      value,
      trimmed = value,
      line = trimmed,
      level
    } = lines[i];

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