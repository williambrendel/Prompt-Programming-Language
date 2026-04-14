"use strict";

const _run = require("./run");
const batch = require("./batch");
const {
  OPUS4_CONFIG,
  SONNET45_CONFIG,
  SONNET46_CONFIG,
  HAIKU45_CONFIG,
} = require("./config");

// Wrapper — _run is frozen; all model helpers and batch attach here instead.
const run = async (config, prompt, ...documents) => await _run(config, prompt, ...documents);

// Add batch to the export.
run.batch = batch;

// --- Opus 4 ---

/**
 * @function run.opus4
 * @memberof run
 * @async
 * @description A specialized version of `run` pre-configured with `OPUS4_CONFIG`.
 * @param {string|Object}            prompt    - The primary user prompt.
 * @param {...(string|Object|Array)} documents - Variadic list of documents to append.
 * @returns {Promise<Object>} See {@link run} for return structure details.
 */
run.opus4 = async (prompt, ...documents) => await run(OPUS4_CONFIG, prompt, ...documents);

/**
 * @function run.opus4.batch
 * @memberof run.opus4
 * @async
 * @description A specialized version of `batch` pre-configured with `OPUS4_CONFIG`.
 * @param {...(Object|Array)} requests - See {@link batch} for request structure.
 * @returns {Promise<Object>} See {@link batch} for return structure details.
 */
run.opus4.batch = async (...requests) => await batch(OPUS4_CONFIG, ...requests);

// --- Sonnet 4.5 ---

/**
 * @function run.sonnet45
 * @memberof run
 * @async
 * @description A specialized version of `run` pre-configured with `SONNET45_CONFIG`.
 * @param {string|Object}            prompt    - The primary user prompt.
 * @param {...(string|Object|Array)} documents - Variadic list of documents to append.
 * @returns {Promise<Object>} See {@link run} for return structure details.
 */
run.sonnet45 = async (prompt, ...documents) => await run(SONNET45_CONFIG, prompt, ...documents);

/**
 * @function run.sonnet45.batch
 * @memberof run.sonnet45
 * @async
 * @description A specialized version of `batch` pre-configured with `SONNET45_CONFIG`.
 * @param {...(Object|Array)} requests - See {@link batch} for request structure.
 * @returns {Promise<Object>} See {@link batch} for return structure details.
 */
run.sonnet45.batch = async (...requests) => await batch(SONNET45_CONFIG, ...requests);

// --- Sonnet 4.6 ---

/**
 * @function run.sonnet46
 * @memberof run
 * @async
 * @description A specialized version of `run` pre-configured with `SONNET46_CONFIG`.
 * @param {string|Object}            prompt    - The primary user prompt.
 * @param {...(string|Object|Array)} documents - Variadic list of documents to append.
 * @returns {Promise<Object>} See {@link run} for return structure details.
 */
run.sonnet46 = async (prompt, ...documents) => await run(SONNET46_CONFIG, prompt, ...documents);

/**
 * @function run.sonnet46.batch
 * @memberof run.sonnet46
 * @async
 * @description A specialized version of `batch` pre-configured with `SONNET46_CONFIG`.
 * @param {...(Object|Array)} requests - See {@link batch} for request structure.
 * @returns {Promise<Object>} See {@link batch} for return structure details.
 */
run.sonnet46.batch = async (...requests) => await batch(SONNET46_CONFIG, ...requests);

// --- Haiku 4.5 ---

/**
 * @function run.haiku45
 * @memberof run
 * @async
 * @description A specialized version of `run` pre-configured with `HAIKU45_CONFIG`.
 * @param {string|Object}            prompt    - The primary user prompt.
 * @param {...(string|Object|Array)} documents - Variadic list of documents to append.
 * @returns {Promise<Object>} See {@link run} for return structure details.
 */
run.haiku45 = async (prompt, ...documents) => await run(HAIKU45_CONFIG, prompt, ...documents);

/**
 * @function run.haiku45.batch
 * @memberof run.haiku45
 * @async
 * @description A specialized version of `batch` pre-configured with `HAIKU45_CONFIG`.
 * @param {...(Object|Array)} requests - See {@link batch} for request structure.
 * @returns {Promise<Object>} See {@link batch} for return structure details.
 */
run.haiku45.batch = async (...requests) => await batch(HAIKU45_CONFIG, ...requests);

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(run, "run", {
  value: run
}));