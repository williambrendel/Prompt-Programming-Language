"use strict";

const { DEFAULT_CONFIG } = require("./config");

/**
 * @function normalizeConfig
 * @description
 * Merges a partial config object with defaults, producing a complete resolved
 * config. If config is not an object, an empty object is used. If
 * defaultConfig is provided, it is merged on top of DEFAULT_CONFIG before
 * applying the caller's config.
 *
 * ## Why there is no longer a key whitelist
 *
 * This used to return a hardcoded set of keys (apiKey, model, max_tokens,
 * temperature, pollInterval, pricing) spread under the caller's config.
 *
 * That whitelist existed for a real reason: `DEFAULT_CONFIG` carried the
 * named presets (`OPUS4_CONFIG`, `HAIKU45_CONFIG`, …) as ordinary enumerable
 * members, so spreading it wholesale would have passed those nested config
 * objects to the API as request parameters.
 *
 * Its cost was that any key NOT on the list was silently dropped — `thinking`
 * among them, so thinking configuration never reached the API at all, and
 * nothing surfaced an error.
 *
 * `config.js` now attaches the presets as non-enumerable properties, so a
 * plain spread is safe and the silent-drop failure mode is gone.
 *
 * ## Null and undefined are stripped
 *
 * A preset must be able to CANCEL an inherited key, not merely decline to set
 * one. Models disagree about which parameters they accept — `temperature` is
 * a 400 on Sonnet 5 and Opus 5, and `thinking: {type:"adaptive"}` is invalid
 * on Haiku 4.5 — so a preset needs to express "do not send this at all".
 * Setting the key to `undefined` shadows the inherited value during the
 * merge; stripping it here means nothing is transmitted.
 *
 * @param {Object} [config]            - Partial config to merge. Non-objects ignored.
 * @param {string} [config.apiKey]     - Anthropic API key.
 * @param {string} [config.model]      - Model identifier.
 * @param {number} [config.max_tokens] - Maximum tokens to generate.
 * @param {number} [config.temperature] - Sampling temperature (0.0–1.0). Omit
 *   for models that reject it.
 * @param {Object} [config.thinking]   - Extended thinking configuration.
 * @param {Object} [config.pricing]    - Per-token pricing rates.
 * @param {Object} [defaultConfig]     - Optional base config merged over
 *   DEFAULT_CONFIG before applying config. Useful for model-specific presets.
 *
 * @returns {Object} Resolved config, with null/undefined values removed.
 *
 * @example
 * const resolved = normalizeConfig({ temperature: 0.2 }, HAIKU45_CONFIG);
 * // resolved.model === HAIKU45_CONFIG.model
 * // resolved.temperature === 0.2
 *
 * @example <caption>Cancelling an inherited key</caption>
 * const resolved = normalizeConfig({ temperature: undefined }, SONNET46_CONFIG);
 * // "temperature" in resolved === false
 */
const normalizeConfig = (config, defaultConfig) => {
  // Normalize input.
  config && typeof config === "object" || (config = {});
  defaultConfig = defaultConfig && typeof defaultConfig === "object" && Object.assign(
    {},
    DEFAULT_CONFIG,
    defaultConfig
  ) || DEFAULT_CONFIG;

  // Spread is safe now that DEFAULT_CONFIG's presets are non-enumerable.
  const merged = { ...defaultConfig, ...config };

  // Drop cancelled keys so they are never transmitted.
  const resolved = {};
  for (const key of Object.keys(merged)) {
    const value = merged[key];
    if (value !== undefined && value !== null) resolved[key] = value;
  }
  return resolved;
};

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(normalizeConfig, "normalizeConfig", {
  value: normalizeConfig
}));
