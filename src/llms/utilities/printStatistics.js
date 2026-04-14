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

  const { params, output, error } = response;

  if (error) {
    console.error("\n🚨 Error:", error);
    return;
  }

  if (output && !Array.isArray(output) && output.success === false) {
    console.error("\n🚨 Error:", output.error);
    return;
  }

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

  if (isBatch) {
    console.log(`   Requests: ${succeeded} succeeded, ${errored} errored`);
    const discountPct = Math.round((1 - batchDiscount) * 100);
    console.log(`   Batch discount: ${discountPct}% off`);
  }

  if (cache) {
    console.log("⚡ Caching: ENABLED");
  }

  // ── Token usage ───────────────────────────────────────────────────────────

  const totalTokens = (inputTokens || 0) + (outputTokens || 0);

  console.log("\n💰 Token Usage:");
  console.log("─────────────────────────────────────");
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
 * @ignore
 */
module.exports = Object.freeze(Object.defineProperty(printStatistics, "printStatistics", {
  value: printStatistics
}));