"use strict";

const math = require("./math");
const { correctQuery, createSpellingEngine } = require("./correctQuery");
const printStatistics = require("./printStatistics");
const getMediaType = require("./getMediaType");

/**
 * @ignore
 * Frozen self-referential export following project conventions.
 */
module.exports = Object.freeze({
  // Math utilities.
  ...math,

  // Spell checking utilities.
  correctQuery,
  createSpellingEngine,
  getMediaType,
  printStatistics
});