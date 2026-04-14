"use strict";

const { DEFAULT_CONFIG } = require("./config");

/**
 * @function normalizeConfig
 * @description
 * Merges a partial config object with defaults, producing a complete resolved config.
 * If config is not an object, an empty object is used. If defaultConfig is provided,
 * it is merged on top of DEFAULT_CONFIG before applying the caller's config.
 *
 * @param {Object} [config]                        - Partial config to merge. Non-objects are ignored.
 * @param {string} [config.apiKey]                 - Anthropic API key.
 * @param {string} [config.model]                  - Model identifier.
 * @param {number} [config.max_tokens]             - Maximum tokens to generate.
 * @param {number} [config.temperature]            - Sampling temperature (0.0–1.0).
 * @param {Object} [config.pricing]                - Per-token pricing rates.
 * @param {Object} [defaultConfig]                 - Optional base config to merge with DEFAULT_CONFIG
 *   before applying config. Useful for model-specific presets.
 *
 * @returns {Object} Fully resolved config with all required fields populated.
 *
 * @example
 * const resolved = normalizeConfig({ temperature: 0.2 }, HAIKU45_CONFIG);
 * // resolved.model === HAIKU45_CONFIG.model
 * // resolved.temperature === 0.2
 */
const normalizeConfig = (config, defaultConfig) => {
  // Normalize input.
  config && typeof config === "object" || (config = {});
  defaultConfig = defaultConfig && typeof defaultConfig === "object" && Object.assign(
    {},
    DEFAULT_CONFIG,
    defaultConfig
  ) || DEFAULT_CONFIG;

  // Merge with default config.
  return {
    ...{
      apiKey: defaultConfig.apiKey,
      model: defaultConfig.model,
      max_tokens: defaultConfig.max_tokens,
      temperature: defaultConfig.temperature,
      pollInterval: defaultConfig.pollInterval,
      pricing: defaultConfig.pricing
    },
    ...config
  };
};

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(normalizeConfig, "normalizeConfig", {
  value: normalizeConfig
}));