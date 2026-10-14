"use strict";

require("dotenv").config();

const apiKey = process.env.ANTHROPIC_API_KEY;

/**
 * @constant
 * @readonly
 * @description
 * Per-model pricing rates (USD per 1M tokens).
 *
 * | Model              | Input  | Cache Write | Cache Read | Output |
 * |--------------------|--------|-------------|------------|--------|
 * | claude-opus-5-5    |  $4.00 |  $5.00      | $0.20      | $20.00 |
 * | claude-opus-5      |  $5.00 |  $6.25      | $0.50      | $25.00 |
 * | claude-sonnet-5-5  |  $2.00 |  $2.50      | $0.10      | $10.00 |
 * | claude-sonnet-5    |  $2.00 |  $2.50      | $0.20      | $10.00 |
 * | claude-sonnet-4-6  |  $3.00 |  $3.75      | $0.30      | $15.00 |
 * | claude-haiku-4-5   |  $1.00 |  $1.25      | $0.10      |  $5.00 |
 *
 * Cache write is +25% over the standard input rate.
 *
 * Cache read is NOT a uniform -90% any more. It is 0.1x base for most models
 * but 0.05x on the 5.5 generation, which makes Sonnet 5.5 strictly cheaper
 * than Sonnet 5 for cache-heavy workloads despite identical base pricing.
 *
 * @type {Object.<string, {input: {standard: number, cacheWrite: number, cacheRead: number}, output: {standard: number}}>}
 */
const PRICING = Object.freeze({
  "claude-opus-5-5": Object.freeze({
    input:  Object.freeze({ standard: 4.00, cacheWrite: 5.00, cacheRead: 0.20 }),
    output: Object.freeze({ standard: 20.00 }),
    batchDiscount: 0.50,
  }),
  "claude-opus-5": Object.freeze({
    input:  Object.freeze({ standard: 5.00, cacheWrite: 6.25, cacheRead: 0.50 }),
    output: Object.freeze({ standard: 25.00 }),
    batchDiscount: 0.50,
  }),
  "claude-sonnet-5-5": Object.freeze({
    input:  Object.freeze({ standard: 2.00, cacheWrite: 2.50, cacheRead: 0.10 }),
    output: Object.freeze({ standard: 10.00 }),
    batchDiscount: 0.50,
  }),
  "claude-sonnet-5": Object.freeze({
    input:  Object.freeze({ standard: 2.00, cacheWrite: 2.50, cacheRead: 0.20 }),
    output: Object.freeze({ standard: 10.00 }),
    batchDiscount: 0.50,
  }),
  "claude-sonnet-4-6": Object.freeze({
    input:  Object.freeze({ standard: 3.00, cacheWrite: 3.75, cacheRead: 0.30 }),
    output: Object.freeze({ standard: 15.00 }),
    batchDiscount: 0.50,
  }),
  "claude-haiku-4-5": Object.freeze({
    input:  Object.freeze({ standard: 1.00, cacheWrite: 1.25, cacheRead: 0.10 }),
    output: Object.freeze({ standard: 5.00 }),
    batchDiscount: 0.50,
  }),
});

/**
 * @constant
 * @readonly
 * @description
 * Model-AGNOSTIC defaults. Nothing model-specific may live here.
 *
 * This separation is load-bearing. `normalizeConfig` merges caller configs
 * over `DEFAULT_CONFIG`, so any model-specific key sitting in the base leaks
 * into every other model's request. Previously `DEFAULT_CONFIG` was a spread
 * of the Sonnet 4.6 preset, so its `temperature: 0.5` reached every model —
 * and Claude Sonnet 5 and Opus 5 REJECT `temperature` with a 400.
 *
 * Keep `model`, `max_tokens`, `temperature`, `thinking` and `pricing` in the
 * presets below. Only add a key here if it is valid for every model.
 *
 * @type {object}
 */
const BASE = Object.freeze({
  apiKey,
  pollInterval: 5000,
});

// ─────────────────────────────────────────────────────────────────────────────
// Current generation
//
// `temperature` was REMOVED on Opus 5.5 / Opus 5 / Sonnet 5.5 / Sonnet 5 —
// sending it is a 400, not a warning. These presets omit it, and
// `normalizeConfig` drops null/undefined so a preset can cancel a key it
// never set rather than silently inheriting one.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Claude Opus 5.5 — highest capability. Cheaper than Opus 5 on every axis
 * ($4/$20 against $5/$25) with cache reads at 0.05x base rather than 0.1x.
 */
const OPUS55_CONFIG = Object.freeze({
  ...BASE,
  model: "claude-opus-5-5",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  pricing: PRICING["claude-opus-5-5"],
});

/** Claude Opus 5 — prior Opus generation. Prefer OPUS55_CONFIG. */
const OPUS5_CONFIG = Object.freeze({
  ...BASE,
  model: "claude-opus-5",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  pricing: PRICING["claude-opus-5"],
});

/**
 * Claude Sonnet 5.5 — best price-to-performance and the default. Same base
 * and output price as Sonnet 5 at half the cache-read rate.
 */
const SONNET55_CONFIG = Object.freeze({
  ...BASE,
  model: "claude-sonnet-5-5",
  max_tokens: 32000,
  thinking: { type: "adaptive" },
  pricing: PRICING["claude-sonnet-5-5"],
});

/** Claude Sonnet 5 — prior Sonnet generation. Prefer SONNET55_CONFIG. */
const SONNET5_CONFIG = Object.freeze({
  ...BASE,
  model: "claude-sonnet-5",
  max_tokens: 32000,
  thinking: { type: "adaptive" },
  pricing: PRICING["claude-sonnet-5"],
});

/**
 * Claude Haiku 4.5 — cheapest tier, for high-throughput classification,
 * extraction and summarisation.
 *
 * Pre-4.6 model: it ACCEPTS `temperature` (verified against the live API) and
 * does NOT accept `thinking: {type:"adaptive"}`. `thinking: undefined` keeps
 * an adaptive setting from a current-generation default leaking in.
 */
const HAIKU45_CONFIG = Object.freeze({
  ...BASE,
  model: "claude-haiku-4-5",
  max_tokens: 32000,
  temperature: 0.3,
  thinking: undefined,
  pricing: PRICING["claude-haiku-4-5"],
});

/** Haiku 4.5, pass 1 (chunk extraction). Temperature 0 for determinism. */
const HAIKU45_PASS1_CONFIG = Object.freeze({
  ...HAIKU45_CONFIG,
  temperature: 0,
});

/** Haiku 4.5, pass 2 (Q&A generation). Temperature 0.3 for phrasing variance. */
const HAIKU45_PASS2_CONFIG = Object.freeze({
  ...HAIKU45_CONFIG,
  temperature: 0.3,
});

// ─────────────────────────────────────────────────────────────────────────────
// Legacy presets — retained for existing callers.
// ─────────────────────────────────────────────────────────────────────────────

/** Claude Sonnet 4.6 — accepts temperature. Prefer SONNET55_CONFIG. */
const SONNET46_CONFIG = Object.freeze({
  ...BASE,
  model: "claude-sonnet-4-6",
  max_tokens: 40000,
  temperature: 0.5,
  thinking: { type: "disabled" },
  pricing: PRICING["claude-sonnet-4-6"],
});

/**
 * @deprecated Alias for {@link SONNET55_CONFIG}.
 *
 * `claude-sonnet-4-20250514` is RETIRED — the API returns 404 for it. The
 * name is kept so existing imports keep resolving. Update call sites and
 * delete this alias.
 */
const SONNET45_CONFIG = SONNET55_CONFIG;

/**
 * @deprecated Alias for {@link OPUS55_CONFIG}.
 *
 * `claude-opus-4-20250514` is RETIRED (404). Opus 5.5 is also under a third
 * of the price: $4/$20 against Opus 4's $15/$75.
 */
const OPUS4_CONFIG = OPUS55_CONFIG;

/**
 * @constant
 * @readonly
 * @description
 * Application default — {@link SONNET55_CONFIG}.
 *
 * The default MUST be a current-generation model, because it is the merge
 * base for every other config. A base carrying `temperature` breaks every
 * current model that merges onto it. A base without one is safe in both
 * directions: legacy presets contribute their own, current presets none.
 *
 * The named presets and PRICING are attached as NON-ENUMERABLE properties.
 * That matters: they used to be plain spread members, which made them
 * enumerable, so `normalizeConfig` needed a hardcoded key whitelist purely to
 * stop `OPUS4_CONFIG` and friends being spread into the request body as API
 * parameters. Making them non-enumerable removes the reason for that
 * whitelist, so new keys like `thinking` reach the API instead of being
 * silently dropped by a list nobody remembered to update.
 */
const DEFAULT_CONFIG = { ...SONNET55_CONFIG };

for (const [name, value] of Object.entries({
  OPUS55_CONFIG, OPUS5_CONFIG,
  SONNET55_CONFIG, SONNET5_CONFIG,
  HAIKU45_CONFIG, HAIKU45_PASS1_CONFIG, HAIKU45_PASS2_CONFIG,
  SONNET46_CONFIG, SONNET45_CONFIG, OPUS4_CONFIG,
  BASE, PRICING,
})) {
  Object.defineProperty(DEFAULT_CONFIG, name, { value, enumerable: false });
}

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(DEFAULT_CONFIG, "DEFAULT_CONFIG", {
  value: DEFAULT_CONFIG
}));
