"use strict";

/**
 * @function printStatistics
 * @description
 * Print token usage, cache performance, and estimated API cost from a Claude API response.
 *
 * Compatible with both `run()` and `batch()` response envelopes:
 * - `run()`   → `{ params, input: Object, output: { success, text }, stats }`
 * - `batch()` → `{ params, input: Array,  output: Array,             stats }`
 *
 * Pricing is read from `params.pricing`. Falls back to Sonnet 4.6 defaults
 * ($3.00 / $15.00 per 1M) if absent. Batch discount is read from
 * `params.pricing.batchDiscount` and applied automatically when the response
 * is detected as a batch (i.e. `stats.succeeded` is present).
 *
 * @param {Object} response - Response envelope produced by `run` or `batch`.
 * @returns {void}
 */
const printStatistics = response => {

  if (!response || typeof response !== "object") {
    throw new Error("printStatistics: invalid response object");
  }

  const {
    input,
    config: _config,
    totalContentSize: _totalContentSize,
    contentLength: _contentLength,
    messages,
    params,
    output,
    error
  } = response || {};
  const totalContentSize = (input || {}).totalContentSize || _totalContentSize;
  const contentLength = _contentLength || (input || {}).contentLength || ((((input || {}).messages || messages || {})[0] || {}).content || []).length;
  const config = _config || (input || {}).config;

  if (error) {
    console.error("\n🚨 Error:", error);
    return;
  }

  if (output && !Array.isArray(output) && output.success === false) {
    console.error("\n🚨 Error:", output.error);
    return;
  }

  const {
    stop_reason,
    stop_reasons = stop_reason,
    stopReason = stop_reasons,
    stopReasons = stopReason,
    stopped = stopReasons
  } = output || {};

  const stats = response.stats || {};
  const {
    duration,
    inputTokens,
    outputTokens,
    cache,
    cacheHit,
    cacheMiss,
    cachedTokensRead,
    cachedTokensCreated,
    succeeded,
    errored,
  } = stats;

  // Pricing — always on params
  const { pricing } = params || {};
  const { input: inputPricing, output: outputPricing } = pricing || {};

  // Rates — fall back to Sonnet 4.6 defaults
  const rateInput      = inputPricing?.standard  ?? 3.00;
  const rateCacheWrite = inputPricing?.cacheWrite ?? 3.75;
  const rateCacheRead  = inputPricing?.cacheRead  ?? 0.30;
  const rateOutput     = outputPricing?.standard  ?? 15.00;

  // Batch discount — read from pricing config, fall back to 1.0 (no discount)
  const isBatch       = succeeded !== undefined;
  const batchDiscount = isBatch ? (pricing?.batchDiscount ?? 1.0) : 1.0;

  // ── Header ────────────────────────────────────────────────────────────────

  console.log(`✅ Response received in ${duration}s`);
  stopped && console.log(`${stopped === "end_turn" && "✅ " || "⚠️  "}Stopped: ${stopped}`);

  if (isBatch) {
    console.log(`   Requests: ${succeeded} succeeded, ${errored} errored`);
    const discountPct = Math.round((1 - batchDiscount) * 100);
    console.log(`   Batch discount: ${discountPct}% off`);
  }

  if (cache) {
    console.log("⚡ Caching: ENABLED");
  }

  // ── Config ────────────────────────────────────────────────────────────────
  if (config) {
    console.log("\n⚙️  Config:");
    console.log("─────────────────────────────────────");
    printObject(config, 3);
  }

  // ── Token usage ───────────────────────────────────────────────────────────

  const totalTokens = (inputTokens || 0) + (outputTokens || 0);

  console.log("\n💰 Token Usage:");
  console.log("─────────────────────────────────────");
  console.log(`   Content length:  ${(contentLength  || 0).toLocaleString()}`);
  console.log(`   Total input size:  ${(totalContentSize  || 0).toLocaleString()}`);
  console.log(`   Input tokens:  ${(inputTokens  || 0).toLocaleString()}`);
  console.log(`   Output tokens: ${(outputTokens || 0).toLocaleString()}`);
  console.log(`   Total tokens:  ${totalTokens.toLocaleString()}`);

  if (cacheHit) {
    console.log(`   Cache hit  — ${(cachedTokensRead    || 0).toLocaleString()} tokens read`);
  } else if (cacheMiss) {
    console.log(`   Cache miss — ${(cachedTokensCreated || 0).toLocaleString()} tokens written`);
  }

  // ── Cost ──────────────────────────────────────────────────────────────────

  const uncachedInputTokens = inputTokens || 0;
  const cacheReadTokens     = cacheHit  ? (cachedTokensRead    ?? 0) : 0;
  const cacheWriteTokens    = cacheMiss ? (cachedTokensCreated ?? 0) : 0;

  const uncachedInputCost = (uncachedInputTokens / 1_000_000) * rateInput      * batchDiscount;
  const cacheReadCost     = (cacheReadTokens     / 1_000_000) * rateCacheRead  * batchDiscount;
  const cacheWriteCost    = (cacheWriteTokens    / 1_000_000) * rateCacheWrite * batchDiscount;
  const outputCost        = ((outputTokens || 0) / 1_000_000) * rateOutput     * batchDiscount;
  const totalCost         = uncachedInputCost + cacheReadCost + cacheWriteCost + outputCost;

  console.log(`   Estimated cost: $${totalCost.toFixed(4)}`);

  if (cache) {
    console.log(`     Uncached input: $${uncachedInputCost.toFixed(4)}  (${uncachedInputTokens.toLocaleString()} tokens @ $${rateInput.toFixed(2)}/1M)`);
    if (cacheHit) {
      console.log(`     Cache read:     $${cacheReadCost.toFixed(4)}  (${cacheReadTokens.toLocaleString()} tokens @ $${rateCacheRead.toFixed(2)}/1M)`);
    } else if (cacheMiss) {
      console.log(`     Cache write:    $${cacheWriteCost.toFixed(4)}  (${cacheWriteTokens.toLocaleString()} tokens @ $${rateCacheWrite.toFixed(2)}/1M)`);
    }
    console.log(`     Output:         $${outputCost.toFixed(4)}  (${(outputTokens || 0).toLocaleString()} tokens @ $${rateOutput.toFixed(2)}/1M)`);
  }

  console.log("─────────────────────────────────────\n");
};

/**
 * @function printObject
 * @private
 * @description
 * Recursively logs an object's key-value pairs to the console with hierarchical 
 * indentation. Supports nested objects and arrays.
 * 
 * @param {Object} obj The target object to be printed.
 * @param {number} [indent=0] The initial number of leading spaces for the current depth.
 * @param {number} [indentStep=2] The number of spaces to add for each nested level of recursion.
 * 
 * @returns {void}
 * 
 * @example
 * const config = { 
 * port: 8080, 
 * db: { host: "localhost", user: "admin" },
 * flags: ["quiet", "debug"] 
 * };
 * printObject(config);
 * // Output:
 * // port: 8080
 * // db:
 * //   host: localhost
 * //   user: admin
 * // flags: [quiet, debug]
 */
const printObject = (obj, indent = 0, indentStep = 2) => {
  const spaces = " ".repeat(indent);
  
  Object.entries(obj).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        console.log(`${spaces}${key}:`);
        printObject(value, indent + indentStep);
    } else if (Array.isArray(value)) {
        console.log(`${spaces}${key}: [${value.join(', ')}]`);
    } else {
        console.log(`${spaces}${key}: ${value}`);
    }
  });
}

/**
 * @ignore
 */
module.exports = Object.freeze(Object.defineProperty(printStatistics, "printStatistics", {
  value: printStatistics
}));