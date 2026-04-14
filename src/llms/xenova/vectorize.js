"use strict";

const { pipeline } = require("@xenova/transformers");
const CONFIG = require("./config");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Matches any character that is not a word character (`\w`), whitespace
 * (`\s`), or a hyphen. Used to strip punctuation from text before embedding
 * while preserving hyphenated compound terms (e.g. `"Legionella-prevention"`,
 * `"bio-film"`) that carry semantic meaning as a unit.
 *
 * Punctuation is replaced with a space rather than deleted outright to prevent
 * adjacent words from merging (e.g. `"treatment.Plan"` → `"treatment Plan"`
 * rather than `"treatmentPlan"`).
 *
 * @type {RegExp}
 * @example
 * "What is water treatment?".replace(RE_PUNCTUATION, " ")
 * // => "What is water treatment "
 */
const RE_PUNCTUATION = /[^\w\s-]/g;

/**
 * Matches one or more consecutive whitespace characters. Applied after
 * {@link RE_PUNCTUATION} substitution to collapse any resulting multi-space
 * runs back to a single space before trimming.
 *
 * @type {RegExp}
 * @example
 * "water  treatment  definition".replace(RE_WHITESPACE, " ")
 * // => "water treatment definition"
 */
const RE_WHITESPACE = /\s+/g;

// ---------------------------------------------------------------------------
// defaultTextNormalization
// ---------------------------------------------------------------------------

/**
 * Default text normalization applied to input strings before embedding.
 *
 * Strips punctuation (except hyphens) via {@link RE_PUNCTUATION}, collapses
 * whitespace runs via {@link RE_WHITESPACE}, and trims leading and trailing
 * whitespace. Casing is intentionally left unchanged — the underlying model
 * (`all-MiniLM-L12-v2`) lowercases internally during tokenization, so manual
 * lowercasing here would be redundant. If the model is ever replaced with a
 * cased variant, this assumption must be revisited.
 *
 * Applied symmetrically at both dataset vectorization time and query time to
 * ensure the embedding space is consistent — punctuation differences between
 * stored vectors and incoming queries never cause asymmetric drift.
 *
 * Exposed as {@link vectorize.defaultTextNormalization} so callers that
 * pre-process text outside of `vectorize` can apply identical normalization
 * and maintain a symmetric embedding space.
 *
 * Can be overridden per-call by passing a custom function as
 * `options.normalizeText`.
 *
 * @function defaultTextNormalization
 * @param {string} text - Raw input string to normalize.
 * @returns {string} Normalized string with punctuation stripped, whitespace
 *   collapsed, and leading/trailing whitespace removed.
 *
 * @example
 * defaultTextNormalization("What is water treatment?")
 * // => "What is water treatment"
 *
 * @example <caption>Hyphens are preserved</caption>
 * defaultTextNormalization("Legionella-prevention — best practices.")
 * // => "Legionella-prevention best practices"
 */
const defaultTextNormalization = (text) => text
  .replace(RE_PUNCTUATION, " ")  // strip punctuation except hyphens
  .replace(RE_WHITESPACE,  " ")  // collapse whitespace runs to a single space
  .trim();                        // remove leading and trailing whitespace

// ---------------------------------------------------------------------------
// vectorize
// ---------------------------------------------------------------------------

/**
 * @file vectorize.js
 * @module core/llms/xenova/vectorize
 * @description Generates dense vector embeddings from text using a locally
 * running Transformer model via `@xenova/transformers` and ONNX Runtime.
 *
 * This module is the single entry point for all text-to-vector operations in
 * the pipeline — used at dataset build time (in `vectorize.js`) and at query
 * time (in the `/query` endpoint). Both paths pass through
 * {@link defaultTextNormalization} by default, ensuring the embedding space
 * is symmetric.
 *
 * A module-level singleton (`model`) caches the extractor pipeline after the
 * first initialization. Callers that build the dataset in batch should pass a
 * pre-initialized extractor via `options.extractor` to avoid re-loading the
 * model on each call.
 *
 * @see {@link https://huggingface.co/docs/transformers.js|Transformers.js Documentation}
 */

/**
 * Generates a dense vector embedding from a text string or array of strings.
 *
 * Maps discrete text tokens into a continuous vector space where semantically
 * similar concepts are mathematically closer to one another. Runs locally via
 * ONNX Runtime, ensuring data privacy and eliminating external API latency.
 *
 * **Text normalization:** by default, punctuation is stripped and whitespace
 * is normalized via {@link defaultTextNormalization} before the text reaches
 * the tokenizer. This can be disabled (`normalizeText: false`) or replaced
 * with a custom function (`normalizeText: myFn`) per call.
 *
 * **Vector normalization:** the output vector is L2-normalized by default
 * (`normalizeVector: true`), which is required for dot product to equal
 * cosine similarity. Disable only if you need raw un-normalized embeddings.
 *
 * The resulting `Float32Array` is suitable for:
 * - **Semantic search** — finding relevant documents by meaning rather than
 *   keywords.
 * - **Clustering** — grouping semantically similar items.
 * - **Classification** — providing dense features for downstream classifiers.
 *
 * @async
 * @function vectorize
 * @param {string|string[]} text
 *   Input string or array of strings to embed. Coerced to `""` if falsy.
 * @param {object}             [options={}]
 *   Configuration for the feature extraction process.
 * @param {string}             [options.pooling="mean"]
 *   Token aggregation strategy. `"mean"` averages all token embeddings into
 *   one sentence vector; `"cls"` uses the first (classification) token.
 * @param {boolean}            [options.normalizeVector=true]
 *   Whether to L2-normalize the output vector. Required when using dot
 *   product as a proxy for cosine similarity.
 * @param {boolean|Function}   [options.normalizeText=true]
 *   Text pre-processing applied before tokenization. `true` uses
 *   {@link defaultTextNormalization}. Pass a custom `function(string):string`
 *   to override. `false` disables normalization entirely.
 * @param {Function}           [options.extractor]
 *   Pre-initialized `@xenova/transformers` pipeline instance. Providing this
 *   avoids reloading the model on every call — recommended for batch
 *   processing. If omitted, the module-level singleton is used or created.
 * @param {string}             [options.featureExtractionModel=CONFIG.featureExtractionModel]
 *   Model ID used to initialize the pipeline if no extractor is provided
 *   (e.g. `"Xenova/all-MiniLM-L12-v2"`).
 * @param {Object}             [options.other]
 *   Additional parameters passed directly to the underlying
 *   Transformers.js pipeline call.
 * @returns {Promise<Float32Array>}
 *   Resolves to a typed array of floats representing the text embedding.
 *   Length depends on the model (384 for MiniLM, 768 for BERT-base).
 *
 * @throws {Error} If the extractor pipeline fails to initialize.
 * @throws {Error} If the model cannot process the input text.
 *
 * @example <caption>Basic usage</caption>
 * const vector = await vectorize("What is water treatment?");
 * // => Float32Array [ 0.012, -0.045, ... ]  (384 dimensions)
 *
 * @example <caption>Pre-initialized extractor for batch processing</caption>
 * const extractor = await createExtractor();
 * for (const text of texts) {
 *   const vec = await vectorize(text, { extractor });
 * }
 *
 * @example <caption>Custom text normalization</caption>
 * const vec = await vectorize("What is pH?", {
 *   normalizeText: (t) => t.toLowerCase().trim(),
 * });
 *
 * @example <caption>Disable normalization for raw embeddings</caption>
 * const rawVec = await vectorize("Quantum computing", {
 *   normalizeVector: false,
 *   normalizeText:   false,
 *   featureExtractionModel: "Xenova/bert-base-uncased",
 * });
 *
 * @see {@link defaultTextNormalization} for the default text pre-processing applied.
 * @see {@link createExtractor} for pre-initializing the pipeline.
 */
let model;
const vectorize = async (
  text,
  {
    pooling          = "mean",
    normalizeVector  = true,
    normalize        = normalizeVector,
    normalizeText    = true,
    extractor,
    featureExtractionModel,
    ...other
  } = {}
) => {
  // ── Initialize extractor ──────────────────────────────────────────────────
  // Reuse the provided extractor, fall back to the module-level singleton,
  // or create a new singleton if this is the first call.

  extractor || (
    extractor = model || (model = await createExtractor(featureExtractionModel))
  );

  // ── Text normalization ────────────────────────────────────────────────────
  // Coerce falsy input to empty string, then apply normalization.
  // If normalizeText is a function, use it directly; otherwise fall back to
  // defaultTextNormalization. Pass normalizeText: false to skip entirely.

  text || (text = "");
  normalizeText && (
    typeof normalizeText === "function" || (normalizeText = defaultTextNormalization),
    text = normalizeText(text)
  );

  // ── Feature extraction ────────────────────────────────────────────────────

  const result = await extractor(text, { pooling, normalize, ...other });

  // ── Output ────────────────────────────────────────────────────────────────
  // Wrap result data in a Float32Array for consistent typed output regardless
  // of what the underlying pipeline returns.

  return new Float32Array(result.data);
};

// ---------------------------------------------------------------------------
// createExtractor
// ---------------------------------------------------------------------------

/**
 * Initializes and returns a `@xenova/transformers` feature-extraction pipeline
 * for the specified model.
 *
 * Exposed as `vectorize.createExtractor` for callers that need to pre-warm
 * the model before processing a batch — pass the returned instance as
 * `options.extractor` to {@link vectorize} to avoid repeated initialization.
 *
 * @async
 * @function createExtractor
 * @param {string} [featureExtractionModel=CONFIG.featureExtractionModel]
 *   Model ID to load (e.g. `"Xenova/all-MiniLM-L12-v2"`). Defaults to the
 *   value configured in {@link CONFIG}.
 * @returns {Promise<Function>} Initialized Transformers.js pipeline instance.
 *
 * @example
 * const extractor = await createExtractor();
 * const vec = await vectorize("water treatment", { extractor });
 */
const createExtractor = async (featureExtractionModel) => (
  await pipeline("feature-extraction", featureExtractionModel || CONFIG.featureExtractionModel)
);

// Attach createExtractor and defaultTextNormalization to the vectorize
// function so they are accessible without additional imports.
vectorize.createExtractor          = createExtractor;
vectorize.defaultTextNormalization = defaultTextNormalization;

/**
 * @ignore
 * Frozen self-referential export following project conventions.
 */
module.exports = Object.freeze(Object.defineProperty(vectorize, "vectorize", {
  value: vectorize,
}));