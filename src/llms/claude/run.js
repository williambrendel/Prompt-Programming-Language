"use strict";

const Anthropic = require('@anthropic-ai/sdk').default;
const normalizeConfig = require("./normalizeConfig");
const buildContent = require("./buildContent");

/**
 * @function run
 * @async
 * @description
 * Orchestrates a request to the Anthropic Claude API, supporting multi-document input
 * and automated prompt caching.
 *
 * This function processes a prompt and an arbitrary number of documents, handles
 * configuration merging, and manages the `"prompt-caching-2024-07-31"` beta header
 * if caching is requested via the input objects.
 *
 * Pricing metadata from the resolved config is attached to the returned `input` object
 * after the API call (it is stripped before the call so the SDK does not reject unknown fields).
 *
 * @param {Object} config                   - Configuration for the Anthropic client and model.
 * @param {string} config.apiKey            - Anthropic API authentication key.
 * @param {string} [config.model]           - Model identifier. Defaults to `DEFAULT_CONFIG.model`.
 * @param {number} [config.max_tokens]      - Maximum tokens to generate. Defaults to `DEFAULT_CONFIG.max_tokens`.
 * @param {number} [config.temperature]     - Sampling temperature (`0.0–1.0`). Defaults to `DEFAULT_CONFIG.temperature`.
 * @param {Object} [config.pricing]         - Per-token pricing rates. Defaults to `DEFAULT_CONFIG.pricing`.
 *   Stripped before the API call and re-attached to `input` afterwards.
 * @param {Object} [config.pricing.input]
 * @param {number} [config.pricing.input.standard]    - Uncached input rate ($/1M tokens).
 * @param {number} [config.pricing.input.cacheWrite]  - Cache write rate ($/1M tokens).
 * @param {number} [config.pricing.input.cacheRead]   - Cache read rate ($/1M tokens).
 * @param {Object} [config.pricing.output]
 * @param {number} [config.pricing.output.standard]   - Output token rate ($/1M tokens).
 *
 * @param {string|Object} prompt - The primary user prompt.
 *   If an Object: `{ data: string, enableCache?: boolean, cache_control?: Object }`.
 * @param {...(string|Object|Array)} documents - Variadic list of documents to append.
 *   Each entry can be a raw string or `{ data, type, mediaType, enableCache, cache_control }`.
 *   Arrays are flattened automatically.
 *
 * @returns {Promise<Object>} A response envelope.
 * @returns {Object}  return.params                            - Model parameters sent to the API.
 * @returns {string}  return.params.model                      - Model used for this request.
 * @returns {number}  return.params.max_tokens                 - Token limit applied.
 * @returns {number}  return.params.temperature                - Temperature applied.
 * @returns {Object}  return.params.pricing                    - Pricing rates for the active model.
 * @returns {number}  return.params.pricing.input.standard     - Standard uncached input rate ($/1M).
 * @returns {number}  return.params.pricing.input.cacheWrite   - Cache write rate ($/1M).
 * @returns {number}  return.params.pricing.input.cacheRead    - Cache read rate ($/1M).
 * @returns {number}  return.params.pricing.output.standard    - Output rate ($/1M).
 * @returns {Array}   return.input                             - Messages array sent to the API.
 * @returns {Object}  return.output                            - Result object.
 * @returns {boolean} return.output.success                    - `true` if the API call succeeded.
 * @returns {string}  [return.output.text]                     - Concatenated text response (on success).
 * @returns {string}  [return.output.error]                    - Error message (on failure).
 * @returns {Object}  return.stats                             - Performance and usage metrics.
 * @returns {string}  return.stats.duration                    - Elapsed time in seconds (2 d.p.).
 * @returns {number}  return.stats.inputTokens                 - Total input tokens consumed.
 * @returns {number}  return.stats.outputTokens                - Total output tokens generated.
 * @returns {boolean} return.stats.cache                       - Whether caching was enabled.
 * @returns {boolean} [return.stats.cacheHit]                  - `true` if response was served from cache.
 * @returns {boolean} [return.stats.cacheMiss]                 - `true` if a new cache entry was created.
 * @returns {number}  [return.stats.cachedTokensRead]          - Tokens read from cache on a hit.
 * @returns {number}  [return.stats.cachedTokensCreated]       - Tokens written to cache on a miss.
 *
 * @example
 * // Basic usage
 * const result = await run(SONNET46_CONFIG, "Summarize this:", doc1, doc2);
 * console.log(result.input.pricing.input.standard); // 3
 *
 * @example
 * // With prompt caching enabled
 * const result = await run(
 *   HAIKU45_CONFIG,
 *   { data: "Analyze these logs:", enableCache: true },
 *   largeDocument
 * );
 * console.log(result.input.pricing.input.cacheRead); // 0.08
 *
 * @example
 * // Compute actual cost from a result
 * const { params: { pricing }, stats } = result;
 * const cost =
 *   ((stats.cachedTokensRead    ?? 0) / 1_000_000) * pricing.input.cacheRead   +
 *   ((stats.cachedTokensCreated ?? 0) / 1_000_000) * pricing.input.cacheWrite  +
 *   ((stats.inputTokens - (stats.cachedTokensRead ?? 0) - (stats.cachedTokensCreated ?? 0))
 *                                     / 1_000_000) * pricing.input.standard    +
 *   (stats.outputTokens               / 1_000_000) * pricing.output.standard;
 * console.log(`$${cost.toFixed(4)}`);
 */
const run = async (config, prompt, ...documents) => {
  const startTime = Date.now();

  // Normalize input configuration.
  const { apiKey, ..._config } = normalizeConfig(config) || {};
  config = _config;
  const clientConfig = { apiKey };

  // Check for the API key.
  if (!clientConfig.apiKey) {
    const error = "ANTHROPIC_API_KEY environment variable not set\nCreate a .env file with: ANTHROPIC_API_KEY=your_api_key_here";
    console.error("❌ Error:", error);
    throw Error(error);
  }

  // Get input content and caching options.
  const { content, cacheEnabled, totalContentSize, contentLength } = buildContent(prompt, ...documents);

  // Check if input content is empty
  if (!totalContentSize) {
    const error = "Content is missing or empty";
    console.error("❌ Error:", error);
    throw Error(error);
  }

  // Build API messages.
  const messages = [{ role: "user", content }];

  // Set caching options to the API.
  if (cacheEnabled) {
    clientConfig.defaultHeaders = { "anthropic-beta": "prompt-caching-2024-07-31" };
  }

  // Create the client.
  const client = new Anthropic(clientConfig);

  // Extract the model parameters.
  const { pollInterval, onPoll, pricing, ...modelParams } = config;
  modelParams.messages = messages;

  // Query API.
  const response = await client.messages.create(modelParams);

  // Collect stats.
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const cacheStats = cacheEnabled && {
    cacheHit: (response.usage.cache_read_input_tokens || 0) > 0,
    cacheMiss: (response.usage.cache_creation_input_tokens || 0) > 0,
    cachedTokensRead: response.usage.cache_read_input_tokens || 0,
    cachedTokensCreated: response.usage.cache_creation_input_tokens || 0
  } || {};

  // Collect text response.
  const text = response.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n");

  // Collect stopping reasons.
  const {
    stop_reason,
    stop_reasons = stop_reason,
    stopReason = stop_reasons,
    stopReasons = stopReason,
    stopped = stopReasons
  } = response;

  // Return response.
  return {
    params: { ...modelParams, pricing },
    input: {
      config,
      messages,
      totalContentSize,
      contentLength
    },
    output: { success: true, text, stopped: stopped || false },
    stats: {
      duration,
      inputTokens: response.usage.input_tokens || 0,
      outputTokens: response.usage.output_tokens || 0,
      cache: cacheEnabled,
      ...cacheStats
    }
  };
};

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(run, "run", {
  value: run
}));