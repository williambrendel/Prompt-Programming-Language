"use strict";

const nspell = require("nspell");

/**
 * @fileoverview
 * Spell-correction utility for user query strings.
 * Splits input into word and non-word tokens, corrects only word tokens
 * using a Hunspell-based engine, and reassembles the original structure
 * including punctuation, numbers, and whitespace.
 *
 * @module correctQuery
 */

/**
 * @ignore
 * Matches one or more whitespace characters.
 * Used to normalize consecutive whitespace inside tokens to a single space.
 * The `g` flag is safe here because this regex is only used with
 * `String.prototype.replace`, which does not rely on `lastIndex`.
 * @type {RegExp}
 */
const RE_SPACE = /\s+/g;

/**
 * @ignore
 * Capturing split pattern that isolates word tokens from non-word tokens.
 * A "word" is defined as:
 * - A sequence of 2+ characters that starts and ends with a letter,
 *   optionally containing apostrophes in the middle (e.g. `don't`, `it's`).
 * - Or a single letter (e.g. `I`, `a`).
 *
 * Using a capturing group in `split` preserves the matched words in the
 * resulting array, interleaved with the non-word segments (punctuation,
 * spaces, numbers).
 * @type {RegExp}
 */
const RE_SPLIT_PUNC = /([a-zA-Z][a-zA-Z']*[a-zA-Z]|[a-zA-Z])/;

/**
 * @ignore
 * Tests whether a token begins with a letter, identifying it as a word
 * token eligible for spell correction.
 * Non-word tokens (punctuation, numbers, whitespace) fail this test
 * and are passed through unchanged.
 * @type {RegExp}
 */
const RE_TEST_WORD = /^[a-zA-Z]/;

/**
 * @ignore
 * Normalizes irregular punctuation sequences:
 * - Multiple commas, exclamation marks, or question marks → single character
 * - Ellipsis variants (.. or ....) → standard ellipsis (...)
 * - Single underscore or tilde → hyphen
 * - Double hyphen or more → em dash
 * @type {RegExp}
 */
const RE_NORM_PUNC = /([,!?])\1+|\.{4,}|\.{2}|[_~]|--+/g;

/**
 * @ignore
 * @function normalizePunctuation
 * @description
 * Normalizes irregular punctuation sequences in a string.
 * @param {string} str - Input string.
 * @returns {string} Normalized string.
 */
const normalizePunctuation = str => str.replace(RE_NORM_PUNC, (match, char) => (
  char ? char :
  (match[0] === "." && "...") ||
  (match[0] === "-" && "—") ||
  "-"
));

/**
 * @ignore
 * @function identity
 * @description
 * Identity filter function. Used with `Array.prototype.filter` to remove
 * empty strings produced at the edges of a `split` result when the input
 * begins or ends with a non-word character.
 * @param {string} x - Token to test.
 * @returns {string} The token itself (falsy for empty strings).
 */
const identity = x => x;

/**
 * @ignore
 * @function mapFunc
 * @description
 * Normalizes internal whitespace within a token to a single space.
 * Applied after splitting to clean up any multi-space sequences that
 * may appear in non-word segments.
 * @param {string} x - Token to normalize.
 * @returns {string} Token with consecutive whitespace collapsed.
 */
const mapFunc = x => x.replace(RE_SPACE, " ");

/**
 * @ignore
 * @function splitWords
 * @description
 * Splits a text string into an array of alternating word and non-word
 * tokens, filtering empty strings and normalizing whitespace.
 *
 * @param {string} text - The input string to tokenize.
 * @returns {string[]} Array of tokens. Word tokens and non-word tokens
 * (punctuation, spaces, numbers) alternate, depending on the input.
 *
 * @example
 * splitWords("Hello, world!");
 * // => ["Hello", ", ", "world", "!"]
 *
 * @example
 * splitWords("don't stop");
 * // => ["don't", " ", "stop"]
 */
const splitWords = text => (text || "").trim().split(RE_SPLIT_PUNC).filter(identity).map(mapFunc);

/**
 * @ignore
 * Known misspellings where nspell's first suggestion is incorrect.
 * Keys are lowercase misspellings, values are the intended corrections.
 * Takes priority over nspell suggestions in createSpellMapFunc.
 * @type {Object<string, string>}
 */
const CORRECTIONS = {
  // ---- Names ----
  nereus: "Nereus",
  gpt: "ChatGPT",
  chatgpt: "ChatGPT",
  gemeni: "Gemeni",
  claude: "Claude",
  deepseek: "Deepseek",
  mistral: "Mistral",
  google: "Google",
  william: "Will",

  // ---- Algae / Biology (domain-specific ranking failures) ----
  algea:    "algae",
  algeae:   "algae",
  alga:     "algae",
  algua:    "algae",

  // ---- Common question words ----
  waht:     "what",
  wehn:     "when",
  wich:     "which",
  wihch:    "which",
  whcih:    "which",
  hwo:      "how",
  woh:      "who",
  wher:     "where",
  whre:     "where",
  whay:     "why",
  hwat:     "what",

  // ---- Common verbs ----
  amke:     "make",
  mkae:     "make",
  mak:      "make",
  ahve:     "have",
  hvae:     "have",
  hav:      "have",
  mkae:     "make",
  taht:     "that",
  teh:      "the",
  thna:     "than",
  thne:     "then",
  tehre:    "there",
  thier:    "their",
  thsy:     "they",
  htey:     "they",
  htis:     "this",
  tihs:     "this",
  htat:     "that",
  wnat:     "want",
  wnat:     "want",
  wriet:    "write",
  wirte:    "write",
  wiht:     "with",
  wtih:     "with",
  wokr:     "work",
  owrk:     "work",
  konw:     "know",
  knwo:     "know",
  jsut:     "just",
  jstu:     "just",
  form:     "from",
  fomr:     "from",
  dont:     "don't",
  doesnt:   "doesn't",
  wont:     "won't",
  cant:     "can't",
  isnt:     "isn't",
  arent:    "aren't",
  wasnt:    "wasn't",
  werent:   "weren't",
  hasnt:    "hasn't",
  havent:   "haven't",
  hadnt:    "hadn't",
  wouldnt:  "wouldn't",
  couldnt:  "couldn't",
  shouldnt: "shouldn't",

  // ---- Common nouns / words ----
  peopel:   "people",
  peolpe:   "people",
  thign:    "thing",
  thigns:   "things",
  somthing: "something",
  somethign: "something",
  eveyr:    "every",
  evrey:    "every",
  becuase:  "because",
  becasue:  "because",
  beacuse:  "because",
  becouse:  "because",
  agian:    "again",
  aigan:    "again",
  alwyas:   "always",
  awlays:   "always",
  alot:     "a lot",
  recieve:  "receive",
  recive:   "receive",
  beleive:  "believe",
  beleif:   "belief",
  untill:   "until",
  occured:  "occurred",
  occuring: "occurring",
  occurance: "occurrence",
  seperate: "separate",
  definately: "definitely",
  definitly: "definitely",
  probaly:  "probably",
  proably:  "probably",
  prolly:   "probably",
  differnt: "different",
  diffrent: "different",
  importnat: "important",
  improtant: "important",
  problme:  "problem",
  problmes: "problems",
  questoin: "question",
  quesiton: "question",
  questiom: "question",
  infomation: "information",
  informaiton: "information",
  informatoin: "information",
  sytem:    "system",
  sytems:   "systems",
  systme:   "system",
  requirment: "requirement",
  requirments: "requirements",
  requiremnt: "requirement",

  // ---- Water treatment specific ----
  corrison:   "corrosion",
  corrision:  "corrosion",
  corosion:   "corrosion",
  scalling:   "scaling",
  scaleing:   "scaling",
  biocied:    "biocide",
  biocied:    "biocide",
  inhibitor:  "inhibitor",
  inhibiter:  "inhibitor",
  inhibiters: "inhibitors",
  conductivty: "conductivity",
  conductiviy: "conductivity",
  alkilinity: "alkalinity",
  alkalinty:  "alkalinity",
  alkaliity:  "alkalinity",
  hardnes:    "hardness",
  turbidty:   "turbidity",
  turbitidy:  "turbidity",
  blowdwon:   "blowdown",
  blowddown:  "blowdown",
  chlorinde:  "chloride",
  cloride:    "chloride",
  sulfite:    "sulfate",
  phospate:   "phosphate",
  phophate:   "phosphate",
  molybdiate: "molybdate",
  dispersent: "dispersant",
  dispersents: "dispersants",
  surfactent: "surfactant",
  surfactents: "surfactants",
  passivaton: "passivation",
  passivtion: "passivation",
  legionella: "Legionella",
  leiginella: "Legionella",
  leginella:  "Legionella",
  ph: "pH",
  PG: "pH",
  eH: "pH",
  eh: "pH",
  cond: "conductivity",
  biome: "microbiome"
};

/**
 * @ignore
 * @function createSpellMapFunc
 * @description
 * Memoized factory that returns a per-token spell-correction function bound
 * to a given `nspell` instance. The result is cached by spell engine identity —
 * if the same instance is passed on consecutive calls, the previously created
 * function is returned without allocating a new closure.
 *
 * The returned map function operates on a single token:
 * - If the token does not start with a letter (punctuation, number, whitespace),
 *   it is returned unchanged.
 * - If the token is a correctly spelled word, it is returned as-is.
 * - If the token is misspelled and suggestions exist, the first suggestion is used.
 * - If no suggestion is available, the original token is kept.
 *
 * If no spell engine is provided (`null`, `undefined`), the identity function
 * is returned, effectively making the map a no-op.
 *
 * @param {Object|null} spell
 * An `nspell` instance to bind the map function to.
 * If falsy, returns {@link identity} (no correction applied).
 *
 * @returns {Function}
 * A `(part: string) => string` function suitable for use with
 * `Array.prototype.map` on a token array produced by {@link splitWords}.
 * The same function reference is returned for repeated calls with the
 * same `spell` instance.
 *
 * @example
 * // Returns a correction function bound to the spell engine
 * const mapFunc = createSpellMapFunc(spell);
 * ["teh", " ", "quikc"].map(mapFunc);
 * // => ["the", " ", "quick"]
 *
 * @example
 * // Same spell instance → same function reference (memoized)
 * const f1 = createSpellMapFunc(spell);
 * const f2 = createSpellMapFunc(spell);
 * f1 === f2; // => true
 *
 * @example
 * // No spell engine → identity function (no-op)
 * const mapFunc = createSpellMapFunc(null);
 * ["teh", " ", "quikc"].map(mapFunc);
 * // => ["teh", " ", "quikc"]
 *
 * @example
 * // Different spell instance → new function allocated
 * const f1 = createSpellMapFunc(spellA);
 * const f2 = createSpellMapFunc(spellB);
 * f1 === f2; // => false
 */
const createSpellMapFunc = ((lastSpell, lastFunc) => (
  spell => (
    !spell && identity
    || (spell === lastSpell && lastFunc)
    || (
      lastSpell = spell,
      lastFunc = part => {
        if (!RE_TEST_WORD.test(part)) return part;
        const lower = part.toLowerCase();
        if (CORRECTIONS[lower]) return CORRECTIONS[lower];
        return spell.correct(part) ? part : spell.suggest(part)[0] || part;
      }
    )
  )
))();

/**
 * @function correctQuery
 * @description
 * Corrects spelling mistakes in a user query string while preserving
 * punctuation, numbers, and whitespace. The input is tokenized into word
 * and non-word segments; only word segments are passed through the spell
 * checker. Non-word segments are returned unchanged.
 *
 * If a word is already correct, it is returned as-is. If it is misspelled
 * and suggestions are available, the first suggestion is used. If no
 * suggestion is available, the original word is kept.
 *
 * A spell engine instance can be provided via the `spell` parameter to
 * avoid recreating it on every call. If omitted, spell correction is skipped
 * and only punctuation normalization is applied. For full correction, prefer
 * creating the engine once with {@link createSpellingEngine} and reusing it.
 *
 * @param {string} query - The raw user query string to correct.
 * @param {Object} [spell] - An `nspell` instance to use for correction.
 * If not provided, only punctuation normalization is applied.
 *
 * @returns {string} The corrected query string with original punctuation
 * and whitespace preserved. Returns the original value if `query` is falsy.
 *
 * @example
 * // Basic correction
 * correctQuery("teh quikc brwon fox", spell);
 * // => "the quick brown fox"
 *
 * @example
 * // Punctuation preserved
 * correctQuery("Whaat is corrosion?", spell);
 * // => "What is corrosion?"
 *
 * @example
 * // Contractions preserved
 * correctQuery("don't worrie about it", spell);
 * // => "don't worry about it"
 *
 * @example
 * // Punctuation normalization only (no spell engine)
 * correctQuery("too many commas,,,");
 * // => "too many commas,"
 *
 * @example
 * // Reusing a spell engine for performance
 * const spell = await correctQuery.createSpellingEngine();
 * const q1 = correctQuery("teh first quuestion", spell);
 * const q2 = correctQuery("teh secnd quuestion", spell);
 *
 * @example
 * // Falsy input is returned as-is
 * correctQuery("");   // => ""
 * correctQuery(null); // => null
 */
const correctQuery = (query, spell) => {
  if (!query) return query;

  query = normalizePunctuation(query);

  return splitWords(query).map(createSpellMapFunc(spell)).join("");
};

/**
 * @function getDomainWords
 * @description
 * Lazily initializes and returns the domain-specific word list used to
 * augment the spell-checking engine with water treatment and industrial
 * terminology not found in the standard English dictionary.
 *
 * The array is allocated once on first call and cached in the module-scoped
 * `domainWords` variable. Subsequent calls return the same array reference
 * without reallocation.
 *
 * Categories covered:
 * - Microorganisms & Biology (e.g. `algae`, `biofilm`, `Legionella`)
 * - Chemistry & Inhibitors (e.g. `phosphonate`, `azole`, `tolyltriazole`)
 * - Corrosion (e.g. `passivation`, `galvanic`, `dezincification`)
 * - Scale & Deposits (e.g. `scalant`, `LSI`, `Langelier`)
 * - Water Quality Parameters (e.g. `alkalinity`, `turbidity`, `ORP`)
 * - Cooling Tower Components (e.g. `blowdown`, `sidestream`, `infill`)
 * - Treatment Systems (e.g. `deionization`, `ozonation`, `biostatic`)
 * - Monitoring & Testing (e.g. `coupon`, `LPR`, `nephelometer`)
 * - Regulatory & Standards (e.g. `ASHRAE`, `AWWA`, `legionellosis`)
 * - Units & Measurements (e.g. `ppm`, `NTU`, `GPM`)
 * - General Industry Terms (e.g. `feedwater`, `deaerator`, `blowdown`)
 *
 * @returns {string[]}
 * The cached array of domain-specific words, ready to be passed to
 * `nspell.add()` or used as the `domainSpecificWords` parameter of
 * {@link createSpellingEngine}.
 *
 * @example
 * // Used automatically by createSpellingEngine
 * const spell = await createSpellingEngine();
 * // => domain words already added
 *
 * @example
 * // Access the list directly
 * const words = getDomainWords();
 * console.log(words.includes("algae")); // => true
 *
 * @example
 * // Same reference on repeated calls (lazy singleton)
 * getDomainWords() === getDomainWords(); // => true
 */
let domainWords;
const getDomainWords = () => domainWords || (domainWords = [
  // ---- About Us ----
  "Nereus", "ChatGPT", "Claude", "Gemeni", "Deepseek", "Mistral", "Google",

  // ---- Microorganisms & Biology ----
  "algae", "algal", "biofilm", "biofilms", "Legionella", "legionella",
  "planktonic", "sessile", "bactericide", "bactericides", "biocide",
  "biocides", "microbial", "microbiological", "microorganism", "microorganisms",
  "tubercle", "tubercles", "tuberculation", "MIC", "nitrification",
  "nitrifying", "denitrification", "biome", "microbiome",

  // ---- Chemistry & Inhibitors ----
  "azole", "azoles", "tolyltriazole", "TTA", "benzotriazole", "BTA",
  "phosphonate", "phosphonates", "phosphate", "phosphates", "molybdate",
  "molybdates", "nitrite", "nitrites", "orthophosphate", "polyphosphate",
  "silicate", "silicates", "chromate", "chromates", "zinc", "zincs",
  "dispersant", "dispersants", "surfactant", "surfactants", "chelant",
  "chelants", "chelate", "chelation", "sequestrant", "sequestrants",

  // ---- Corrosion ----
  "corrosion", "corrosive", "corrosivity", "passivation", "passivate",
  "passivating", "depassivation", "galvanic", "galvanized", "galvanizing",
  "dealloying", "dezincification", "pitting", "crevice", "erosion",
  "erosive", "underdeposit", "cathodic", "anodic", "anode", "cathode",
  "electrolyte", "electrolytic",

  // ---- Scale & Deposits ----
  "scaling", "scalant", "scalants", "antiscalant", "antiscalants",
  "carbonate", "carbonates", "bicarbonate", "bicarbonates", "sulfate",
  "sulfates", "silica", "siliceous", "calcite", "aragonite", "brucite",
  "hydroxyapatite", "LSI", "RSI", "Langelier", "Ryznar", "Puckorius",
  "nucleation", "precipitation", "supersaturation",

  // ---- Water Quality Parameters ----
  "conductivity", "alkalinity", "hardness", "turbidity", "chlorides",
  "chloride", "sulfates", "TDS", "TSS", "TOC", "COD", "BOD", "ORP",
  "redox", "pH", "ph", "manganese", "iron", "calcium", "magnesium",
  "potassium", "sodium", "bromide", "fluoride",

  // ---- Cooling Tower Components ----
  "blowdown", "blowdowns", "makeup", "driftloss", "drift",
  "recirculation", "sidestream", "sidestreams", "strainer", "strainers",
  "nozzle", "nozzles", "eliminators", "infill", "counterflow",
  "crossflow", "inductedraft", "forceddraft", "basin", "basins",
  "sump", "sumps", "fillpack", "louvers", "casing",

  // ---- Treatment Systems ----
  "softener", "softeners", "softening", "deionization", "demineralization",
  "ultrafiltration", "nanofiltration", "microfiltration", "RO", "SWRO",
  "BWRO", "EDI", "electrodeionization", "UV", "ozonation", "ozone",
  "chlorination", "dechlorination", "bromination", "bromine",
  "nonoxidizing", "oxidizing", "biostatic",

  // ---- Monitoring & Testing ----
  "coupon", "coupons", "LPR", "polarization", "potentiostat",
  "colorimetric", "titrimetric", "titration", "titrations", "DPD",
  "spectrophotometer", "spectrophotometry", "turbidimeter", "nephelometer",
  "ATP", "HPC", "SRB", "IOB", "APB", "sessile", "planktonic",
  "heterotrophic",

  // ---- Regulatory & Standards ----
  "ASHRAE", "OSHA", "EPA", "CDC", "AWWA", "NACE", "AWT", "CTI",
  "ANSI", "NSF", "WQA", "IAPMO", "legionellosis", "Pontiac",

  // ---- Units & Measurements ----
  "ppm", "ppb", "ppt", "GPM", "GPH", "MGD", "PSI", "PSIG", "PSIA",
  "BTU", "kWh", "NTU", "SFU", "mV", "μS", "mS",

  // ---- General Industry Terms ----
  "passivate", "pretreatment", "posttreatment", "dosing", "feedrate",
  "blending", "dilution", "concentration", "cycles", "COC",
  "evaporation", "evaporative", "chiller", "chillers",
  "condenser", "condensers", "HVAC", "boiler", "boilers", "feedwater",
  "condensate", "steamtrap", "deaerator", "deaeration",
]);

/**
 * @function createSpellingEngine
 * @description
 * Async factory that creates and returns a new `nspell` spell-checking engine,
 * pre-loaded with the standard English dictionary and optionally augmented with
 * domain-specific terminology via {@link getDomainWords}.
 *
 * Use this to instantiate the engine once at application startup and pass
 * it to repeated calls to {@link correctQuery}, avoiding the overhead of
 * recreating the engine on every invocation.
 *
 * @param {Object} [dic] - A Hunspell-compatible dictionary object.
 * If not provided, `dictionary-en` is loaded dynamically via `import()`.
 * @param {string|string[]} [domainSpecificWords=getDomainWords()]
 * A word or array of words to add to the engine after initialization.
 * Defaults to the full domain word list from {@link getDomainWords}.
 * Pass `null` or `[]` to skip domain augmentation entirely.
 *
 * @returns {Promise<Object>} Resolves to an `nspell` instance ready for
 * `.correct()` and `.suggest()` calls, with domain words pre-loaded.
 *
 * @example
 * // Create once at startup with default domain words
 * const spell = await correctQuery.createSpellingEngine();
 *
 * // Reuse across requests
 * app.post("/query", (req, res) => {
 *   const corrected = correctQuery(req.body.query, spell);
 *   // ...
 * });
 *
 * @example
 * // Skip domain words
 * const spell = await correctQuery.createSpellingEngine(null, null);
 *
 * @example
 * // Custom dictionary
 * const { default: frDic } = await import("dictionary-fr");
 * const spell = await correctQuery.createSpellingEngine(frDic, []);
 *
 * @example
 * // Custom domain words
 * const spell = await correctQuery.createSpellingEngine(null, ["myTerm", "anotherTerm"]);
 */
const createSpellingEngine = async (dic, domainSpecificWords = getDomainWords()) => (
  dic || (dic = (await import("dictionary-en")).default),
  dic = nspell(dic),
  domainSpecificWords && (
    Array.isArray(domainSpecificWords) || (domainSpecificWords = [domainSpecificWords]),
    domainSpecificWords.forEach(w => dic.add(w))
  ),
  dic
);

/**
 * @ignore
 * Default export with freezing.
 */
correctQuery.createSpellingEngine = createSpellingEngine;
correctQuery.getDomainWords = getDomainWords;
module.exports = Object.freeze(Object.defineProperty(correctQuery, "correctQuery", {
  value: correctQuery
}));