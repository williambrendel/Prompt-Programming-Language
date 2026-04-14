/**
 * @file normalizeUtils.js
 * @brief String normalization suite for variables, blocks, and keywords.
 */

"use strict";

/** 
 * @constant {RegExp} SP_RE Matches whitespace, underscores, or hyphens globally.
 * @private
 * */
const SP_RE = /[\s\_\-]+/g;

/** 
 * @constant {RegExp} K_RE1 Matches accronym boundaries for camelCase/PascalCase splitting.
 * @private
 * */
const K_RE1 = /([A-Z]+)([A-Z][a-z0-9])/g;  // APIIs → API_Is

/** 
 * @constant {RegExp} K_RE@ Matches boundaries for camelCase/PascalCase splitting.
 * @private
 * */
const K_RE2 = /([a-z0-9])([A-Z])/g;         // IsAwesome → Is_Awesome

/**
 * @function createNormalizeName
 * @description A factory that creates a normalization function for a specific prefix.
 * @private
 * 
 * @param {string} pre - The character prefix to enforce (e.g., "$", "@").
 * 
 * @returns {Function} A specialized normalization function.
 * 
 * @example
 * const customNormalizer = createNormalizeName("#");
 * console.log(customNormalizer("My Tag")); // "#my_tag"
 */
const createNormalizeName = pre => {
  const RE = new RegExp(`^\\${pre}+`);
  return name => name && (
    name = `${name}`.trim(),
    name.charAt(0) === pre && name.replace(RE, pre) || `${pre}${name}`
  ).replace(K_RE1, "$1_$2").replace(K_RE2, "$1_$2").replace(SP_RE, "_").toLowerCase() || ""
}

/**
 * @function normalizeVariableName
 * @description Normalizes a string to a lowercase snake_case variable prefixed with '$'.
 * 
 * @param {string} name - The raw string to transform.
 * 
 * @returns {string} The normalized variable name.
 * 
 * @example
 * normalizeVariableName("UserFirstName"); // "$user_first_name"
 * normalizeVariableName("  $AlreadyPrefixed"); // "$already_prefixed"
 */
const normalizeVariableName = createNormalizeName("$");

/**
 * @function normalizeBlockName
 * @description Normalizes a string to a lowercase snake_case block name prefixed with '@'.
 * 
 * @param {string} name - The raw string to transform.
 * 
 * @returns {string} The normalized block name.
 * 
 * @example
 * normalizeBlockName("Hero Section"); // "@hero_section"
 * normalizeBlockName("@@ExtraPrefix"); // "@extra_prefix"
 */
const normalizeBlockName = createNormalizeName("@");

/**
 * @function normalizeKeyword
 * @description Converts a string to uppercase words separated by single spaces.
 * 
 * @param {string} str - The raw string to transform.
 * 
 * @returns {string} The uppercase keyword string.
 * 
 * @example
 * normalizeKeyword("apiResponseCode"); // "API RESPONSE CODE"
 * normalizeKeyword("meta-data_key"); // "META DATA KEY"
 */
const normalizeKeyword = str => str && (
  str.replace(K_RE1, "$1_$2").replace(K_RE2, "$1_$2").replace(SP_RE, " ").toUpperCase()
) || "";

/**
 * @function normalizeTitle
 * @description Alias for @see normalizeKeyword.
 * 
 * @param {string} str - The raw string to transform.
 * 
 * @returns {string} The uppercase title string.
 * 
 * @example
 * normalizeTitle("apiResponseCode"); // "API RESPONSE CODE"
 * normalizeTitle("meta-data_key"); // "META DATA KEY"
 */
const normalizeTitle = normalizeKeyword;


/**
 * @ignore
 * Module exports with frozen properties for safety.
 */
module.exports = Object.freeze({
  createNormalizeName,
  normalizeVariableName,
  normalizeBlockName,
  normalizeKeyword,
  normalizeTitle
});