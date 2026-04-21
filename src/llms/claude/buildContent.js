"use strict";

const { getMediaType, json: JSON_MEDIA_TYPE, text: TEXT_MEDIA_TYPE } = require("../utilities/getMediaType");

/**
 * @function buildContent
 * @description
 * Constructs the content array for an Anthropic API message from a prompt and
 * zero or more documents. Handles cache_control injection and flattens nested
 * document arrays automatically.
 *
 * @param {string|Object} prompt - The primary user prompt.
 *   If a string: used as-is.
 *   If an Object: `{ data: string, enableCache?: boolean, cache_control?: Object }`.
 * @param {...(string|Object|Array)} documents - Variadic documents to append after the prompt.
 *   Each entry can be:
 *   - A raw string — wrapped as a plain text document.
 *   - An Object: `{ data, type?, mediaType?, enableCache?, cache_control? }`.
 *   - An Array — flattened recursively via flat(Infinity).
 *
 * @returns {{ content: Array, cacheEnabled: boolean, contentSize: integer }}
 *   content      - Array of content blocks ready for the messages API.
 *   cacheEnabled - true if any block has cache_control set (triggers beta header).
 *   totalContentSize  - Overall size of the content.
 *
 * @example
 * const { content, cacheEnabled } = buildContent(
 *   { data: "Summarize this:", enableCache: true },
 *   "document text here"
 * );
 * // content[0].cache_control === { type: "ephemeral" }
 * // cacheEnabled === true
 */
const buildContent = (prompt, ...documents) => {
  const content = [];
  let cacheEnabled = false, totalContentSize = 0;
  documents = documents.flat(Infinity);

  // Prompt
  const promptEntry = { type: "text", text: prompt };
  if (typeof prompt === "object") {
    promptEntry.text = prompt.data;
    if (prompt.cache_control) {
      promptEntry.cache_control = prompt.cache_control;
      cacheEnabled = true;
    } else if (prompt.enableCache) {
      promptEntry.cache_control = { type: "ephemeral" };
      cacheEnabled = true;
    }
  }
  content.push(promptEntry);

  // Documents
  for (const document of documents) {
    if (!document) continue;
    const entry = {
      type: "document",
      source: {
        data: document,
        type: "text",
        media_type: TEXT_MEDIA_TYPE,
      }
    };
    if (typeof document === "object") {
      entry.source = {
        data: document.data,
        type: document.type || "text",
        media_type: getMediaType(document.mediaType),
      };
      if (document.cache_control) {
        entry.cache_control = document.cache_control;
        cacheEnabled = true;
      } else if (document.enableCache) {
        entry.cache_control = { type: "ephemeral" };
        cacheEnabled = true;
      }
      if (!entry.source.data) {
        try {
          entry.source = {
            data: JSON.stringify(document),
            type: "text",
            media_type: JSON_MEDIA_TYPE,
          };
        } catch (error) {
          console.error("❌ Error:", error);
          continue;
        }
      }
    }
    const data = entry.source.data || "";
    const size = typeof data === "string" && data.trim().length || data.length;
    size && (
      totalContentSize += size,
      content.push(entry)
    );
  }

  return { content, cacheEnabled, totalContentSize, contentLength: content.length };
};

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(buildContent, "buildContent", {
  value: buildContent
}));