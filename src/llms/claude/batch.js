"use strict";

const Anthropic = require('@anthropic-ai/sdk').default;
const normalizeConfig = require("./normalizeConfig");
const buildContent = require("./buildContent");

/**
 * @function batch
 * @async
 * @description
 * Submits a batch of requests to the Anthropic Message Batches API at 50% cost,
 * polls until completion, and returns results mirroring the run() envelope.
 *
 * @param {Object}   config                        - Same config as run(), plus batch options.
 * @param {string}   config.apiKey                 - Anthropic API key. Required.
 * @param {number}   [config.pollInterval=5000]    - Polling interval in ms.
 * @param {Function} [config.onPoll]               - Called each poll with batch status object.
 * @param {...(Object|Array)} requests             - Variadic list of request objects or arrays.
 *   Each request: { id: string, prompt: string|Object, documents?: Array }
 *   id must be unique within the batch. Arrays are flattened automatically.
 *
 * @returns {Promise<Object>} Result envelope mirroring run(), with arrays for batch:
 *   {
 *     input:  Array of config+messages objects, one per request.
 *     output: Array of { id, success, text?, error?, inputTokens, outputTokens }, one per request.
 *     stats:  Cumulated across all requests:
 *       { duration, inputTokens, outputTokens, cachedTokensRead, cachedTokensCreated,
 *         cache, cacheHit, cacheMiss, succeeded, errored }
 *   }
 *
 * @example
 * const { input, output, stats } = await batch(HAIKU45_CONFIG,
 *   { id: "chunk-0", prompt: pass2Prompt, documents: [chunkInput0] },
 *   { id: "chunk-1", prompt: pass2Prompt, documents: [chunkInput1] },
 * );
 * output.forEach(r => { if (r.success) console.log(r.id, r.text); });
 * console.log(`Total tokens: ${stats.inputTokens + stats.outputTokens}`);
 */
const batch = async (config, ...requests) => {
  const startTime = Date.now();
  requests = requests.flat(Infinity);

  config = normalizeConfig(config);
  const { pollInterval = 5000, onPoll, pricing, apiKey, ...modelParams } = config;

  if (!apiKey) {
    const error = "ANTHROPIC_API_KEY environment variable not set";
    console.error("❌ Error:", error);
    throw Error(error);
  }

  const client = new Anthropic({ apiKey });

  // Build batch requests
  const batchRequests = requests.map(({ id, prompt, documents = [] }) => {
    const { content } = buildContent(prompt, ...documents);
    return {
      custom_id: id,
      params: {
        model: modelParams.model,
        max_tokens: modelParams.max_tokens,
        temperature: modelParams.temperature,
        messages: [{ role: "user", content }],
      }
    };
  });

  // Submit batch
  const batchJob = await client.beta.messages.batches.create({ requests: batchRequests });
  const batchId = batchJob.id;
  console.log(`  Batch submitted: ${batchId} (${requests.length} requests)`);

  // Poll until ended
  let status = batchJob;
  while (status.processing_status !== "ended") {
    await new Promise(r => setTimeout(r, pollInterval));
    status = await client.beta.messages.batches.retrieve(batchId);
    onPoll?.(status);
    console.log(`  Batch ${batchId}: ${status.processing_status} — ${JSON.stringify(status.request_counts)}`);
  }

  // Collect results
  const output = [];
  const stats = {
    inputTokens: 0, outputTokens: 0,
    cachedTokensRead: 0, cachedTokensCreated: 0,
    succeeded: 0, errored: 0,
  };

  for await (const result of await client.beta.messages.batches.results(batchId)) {
    const id = result.custom_id;
    if (result.result.type === "succeeded") {
      const msg = result.result.message;
      const inputTokens = msg.usage.input_tokens;
      const outputTokens = msg.usage.output_tokens;
      const cachedTokensRead = msg.usage.cache_read_input_tokens || 0;
      const cachedTokensCreated = msg.usage.cache_creation_input_tokens || 0;
      output.push({
        id,
        success: true,
        text: msg.content.filter(b => b.type === "text").map(b => b.text).join("\n"),
        inputTokens,
        outputTokens,
      });
      stats.inputTokens += inputTokens;
      stats.outputTokens += outputTokens;
      stats.cachedTokensRead += cachedTokensRead;
      stats.cachedTokensCreated += cachedTokensCreated;
      stats.succeeded++;
    } else {
      output.push({
        id,
        success: false,
        error: result.result.error?.message || result.result.type,
        inputTokens: 0,
        outputTokens: 0,
      });
      stats.errored++;
    }
  }

  stats.duration = ((Date.now() - startTime) / 1000).toFixed(2);
  stats.cache = stats.cachedTokensRead > 0 || stats.cachedTokensCreated > 0;
  stats.cacheHit = stats.cachedTokensRead > 0;
  stats.cacheMiss = stats.cachedTokensCreated > 0;

  // Build input array — one messages array per request
  const input = requests.map(({ prompt, documents = [] } = {}) => {
    const { content } = buildContent(prompt, ...documents);
    return [{ role: "user", content }];
  });

  return { params: { ...modelParams, pricing }, input, output, stats };
};

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(batch, "batch", {
  value: batch
}));