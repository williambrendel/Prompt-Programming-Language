"use strict";

const {
  createNormalizeName,
  normalizeVariableName,
  normalizeBlockName,
  normalizeKeyword,
  normalizeTitle,
} = require("../../../src/utilities/serialize/normalizeUtils");

// ── createNormalizeName ─────────────────────────────────────────────────────

describe("createNormalizeName", () => {

  describe("factory", () => {

    test("returns a function", () => {
      expect(typeof createNormalizeName("#")).toBe("function");
    });

    test("creates independent normalizers for different prefixes", () => {
      const hashNorm = createNormalizeName("#");
      const bangNorm = createNormalizeName("!");
      expect(hashNorm("#hello")).toBe("hello");
      expect(bangNorm("!hello")).toBe("hello");
    });

  });

  describe("prefix stripping", () => {

    test("strips prefix when present", () => {
      const norm = createNormalizeName("#");
      expect(norm("#hello")).toBe("hello");
    });

    test("leaves string unchanged when prefix absent", () => {
      const norm = createNormalizeName("#");
      expect(norm("hello")).toBe("hello");
    });

    test("strips multiple leading prefixes", () => {
      const norm = createNormalizeName("#");
      expect(norm("###hello")).toBe("hello");
    });

    test("trims whitespace before checking prefix", () => {
      const norm = createNormalizeName("#");
      expect(norm("  #hello")).toBe("hello");
    });

  });

  describe("falsy input", () => {

    test("returns empty string for empty string", () => {
      const norm = createNormalizeName("#");
      expect(norm("")).toBe("");
    });

    test("returns empty string for null", () => {
      const norm = createNormalizeName("#");
      expect(norm(null)).toBe("");
    });

    test("returns empty string for undefined", () => {
      const norm = createNormalizeName("#");
      expect(norm(undefined)).toBe("");
    });

    test("returns empty string for 0", () => {
      const norm = createNormalizeName("#");
      expect(norm(0)).toBe("");
    });

    test("returns empty string for false", () => {
      const norm = createNormalizeName("#");
      expect(norm(false)).toBe("");
    });

  });

  describe("case and separator normalization", () => {

    test("lowercases result", () => {
      const norm = createNormalizeName("#");
      expect(norm("HELLO")).toBe("hello");
    });

    test("replaces spaces with underscores", () => {
      const norm = createNormalizeName("#");
      expect(norm("My Tag")).toBe("my_tag");
    });

    test("replaces hyphens with underscores", () => {
      const norm = createNormalizeName("#");
      expect(norm("my-tag")).toBe("my_tag");
    });

    test("replaces underscores with single underscore", () => {
      const norm = createNormalizeName("#");
      expect(norm("my_tag")).toBe("my_tag");
    });

    test("collapses multiple separators into one underscore", () => {
      const norm = createNormalizeName("#");
      expect(norm("my   tag")).toBe("my_tag");
      expect(norm("my---tag")).toBe("my_tag");
      expect(norm("my___tag")).toBe("my_tag");
      expect(norm("my - _tag")).toBe("my_tag");
    });

    test("splits camelCase into snake_case", () => {
      const norm = createNormalizeName("#");
      expect(norm("myTagName")).toBe("my_tag_name");
    });

    test("splits PascalCase into snake_case", () => {
      const norm = createNormalizeName("#");
      expect(norm("MyTagName")).toBe("my_tag_name");
    });

    test("splits consecutive uppercase (acronym) correctly", () => {
      const norm = createNormalizeName("#");
      expect(norm("APIResponse")).toBe("api_response");
    });

  });

});

// ── normalizeVariableName ────────────────────────────────────────────────────

describe("normalizeVariableName", () => {

  describe("prefix stripping", () => {

    test("strips $ when present", () => {
      expect(normalizeVariableName("$question")).toBe("question");
    });

    test("leaves string unchanged when $ absent", () => {
      expect(normalizeVariableName("question")).toBe("question");
    });

    test("strips multiple $ prefixes", () => {
      expect(normalizeVariableName("$$$question")).toBe("question");
    });

    test("trims whitespace then strips prefix", () => {
      expect(normalizeVariableName("  $question")).toBe("question");
      expect(normalizeVariableName("  question  ")).toBe("question");
    });

  });

  describe("falsy input", () => {

    test("returns empty string for empty string", () => {
      expect(normalizeVariableName("")).toBe("");
    });

    test("returns empty string for null", () => {
      expect(normalizeVariableName(null)).toBe("");
    });

    test("returns empty string for undefined", () => {
      expect(normalizeVariableName(undefined)).toBe("");
    });

  });

  describe("case and separator normalization", () => {

    test("lowercases result", () => {
      expect(normalizeVariableName("QUESTION")).toBe("question");
    });

    test("acronym", () => {
      expect(normalizeVariableName("myAPIIsAwesome")).toBe("my_api_is_awesome");
    });

    test("converts camelCase to snake_case", () => {
      expect(normalizeVariableName("userFirstName")).toBe("user_first_name");
    });

    test("converts PascalCase to snake_case", () => {
      expect(normalizeVariableName("UserFirstName")).toBe("user_first_name");
    });

    test("converts spaces to underscores", () => {
      expect(normalizeVariableName("user first name")).toBe("user_first_name");
    });

    test("converts hyphens to underscores", () => {
      expect(normalizeVariableName("user-first-name")).toBe("user_first_name");
    });

    test("collapses multiple separators", () => {
      expect(normalizeVariableName("user  first--name")).toBe("user_first_name");
    });

    test("handles acronym prefix correctly", () => {
      expect(normalizeVariableName("APIResponse")).toBe("api_response");
    });

    test("already prefixed and mixed case", () => {
      expect(normalizeVariableName("  $AlreadyPrefixed")).toBe("already_prefixed");
    });

  });

  describe("PPL2 variable scenarios", () => {

    test("normalizes question", () => {
      expect(normalizeVariableName("question")).toBe("question");
    });

    test("normalizes verified_answer", () => {
      expect(normalizeVariableName("verifiedAnswer")).toBe("verified_answer");
    });

    test("normalizes relevance_score", () => {
      expect(normalizeVariableName("relevanceScore")).toBe("relevance_score");
    });

    test("normalizes raw_results", () => {
      expect(normalizeVariableName("raw-results")).toBe("raw_results");
    });

  });

});

// ── normalizeBlockName ───────────────────────────────────────────────────────

describe("normalizeBlockName", () => {

  describe("prefix stripping", () => {

    test("strips @ when present", () => {
      expect(normalizeBlockName("@search_kb")).toBe("search_kb");
    });

    test("leaves string unchanged when @ absent", () => {
      expect(normalizeBlockName("search_kb")).toBe("search_kb");
    });

    test("strips multiple @ prefixes", () => {
      expect(normalizeBlockName("@@search_kb")).toBe("search_kb");
      expect(normalizeBlockName("@@@ExtraPrefix")).toBe("extra_prefix");
    });

    test("trims whitespace then strips prefix", () => {
      expect(normalizeBlockName("  @search_kb")).toBe("search_kb");
      expect(normalizeBlockName("  search_kb  ")).toBe("search_kb");
    });

  });

  describe("falsy input", () => {

    test("returns empty string for empty string", () => {
      expect(normalizeBlockName("")).toBe("");
    });

    test("returns empty string for null", () => {
      expect(normalizeBlockName(null)).toBe("");
    });

    test("returns empty string for undefined", () => {
      expect(normalizeBlockName(undefined)).toBe("");
    });

  });

  describe("case and separator normalization", () => {

    test("lowercases result", () => {
      expect(normalizeBlockName("SEARCH_KB")).toBe("search_kb");
    });

    test("acronym", () => {
      expect(normalizeBlockName("myAPIIsAwesome")).toBe("my_api_is_awesome");
    });

    test("converts camelCase to snake_case", () => {
      expect(normalizeBlockName("searchKnowledgeBase")).toBe("search_knowledge_base");
    });

    test("converts PascalCase to snake_case", () => {
      expect(normalizeBlockName("SearchKnowledgeBase")).toBe("search_knowledge_base");
    });

    test("converts spaces to underscores", () => {
      expect(normalizeBlockName("Hero Section")).toBe("hero_section");
    });

    test("converts hyphens to underscores", () => {
      expect(normalizeBlockName("hero-section")).toBe("hero_section");
    });

    test("collapses multiple separators", () => {
      expect(normalizeBlockName("hero  --  section")).toBe("hero_section");
    });

    test("handles acronym prefix", () => {
      expect(normalizeBlockName("APICall")).toBe("api_call");
    });

  });

  describe("PPL2 block scenarios", () => {

    test("normalizes embed", () => {
      expect(normalizeBlockName("embed")).toBe("embed");
    });

    test("normalizes search_kb", () => {
      expect(normalizeBlockName("searchKb")).toBe("search_kb");
    });

    test("normalizes check_relevance", () => {
      expect(normalizeBlockName("checkRelevance")).toBe("check_relevance");
    });

    test("normalizes generate_from_kb", () => {
      expect(normalizeBlockName("generateFromKb")).toBe("generate_from_kb");
    });

    test("normalizes verify_answer", () => {
      expect(normalizeBlockName("verify answer")).toBe("verify_answer");
    });

  });

});

// ── normalizeKeyword ─────────────────────────────────────────────────────────

describe("normalizeKeyword", () => {

  describe("falsy input", () => {

    test("returns empty string for empty string", () => {
      expect(normalizeKeyword("")).toBe("");
    });

    test("returns empty string for null", () => {
      expect(normalizeKeyword(null)).toBe("");
    });

    test("returns empty string for undefined", () => {
      expect(normalizeKeyword(undefined)).toBe("");
    });

    test("returns empty string for 0", () => {
      expect(normalizeKeyword(0)).toBe("");
    });

    test("returns empty string for false", () => {
      expect(normalizeKeyword(false)).toBe("");
    });

  });

  describe("uppercasing", () => {

    test("uppercases a single word", () => {
      expect(normalizeKeyword("hello")).toBe("HELLO");
    });

    test("uppercases already uppercase string", () => {
      expect(normalizeKeyword("HELLO")).toBe("HELLO");
    });

    test("acronym", () => {
      expect(normalizeKeyword("myAPIIsAwesome")).toBe("MY API IS AWESOME");
    });

  });

  describe("separator normalization", () => {

    test("replaces hyphens with spaces", () => {
      expect(normalizeKeyword("meta-data-key")).toBe("META DATA KEY");
    });

    test("replaces underscores with spaces", () => {
      expect(normalizeKeyword("meta_data_key")).toBe("META DATA KEY");
    });

    test("collapses multiple separators into one space", () => {
      expect(normalizeKeyword("meta   data___key")).toBe("META DATA KEY");
      expect(normalizeKeyword("meta-_-data")).toBe("META DATA");
    });

  });

  describe("camelCase and PascalCase splitting", () => {

    test("splits camelCase into space-separated words", () => {
      expect(normalizeKeyword("apiResponseCode")).toBe("API RESPONSE CODE");
    });

    test("splits PascalCase into space-separated words", () => {
      expect(normalizeKeyword("ApiResponseCode")).toBe("API RESPONSE CODE");
    });

    test("splits consecutive uppercase acronym correctly", () => {
      expect(normalizeKeyword("APIResponse")).toBe("API RESPONSE");
    });

    test("handles mixed separators and camelCase", () => {
      expect(normalizeKeyword("meta-data_key")).toBe("META DATA KEY");
    });

  });

  describe("PPL2 keyword scenarios", () => {

    test("normalizes TO ACHIEVE", () => {
      expect(normalizeKeyword("to achieve")).toBe("TO ACHIEVE");
    });

    test("normalizes USER INPUTS", () => {
      expect(normalizeKeyword("user inputs")).toBe("USER INPUTS");
    });

    test("normalizes USER INPUTS from camelCase", () => {
      expect(normalizeKeyword("userInputs")).toBe("USER INPUTS");
    });

    test("normalizes SUBSTEP", () => {
      expect(normalizeKeyword("substep")).toBe("SUBSTEP");
    });

    test("normalizes NEXT", () => {
      expect(normalizeKeyword("next")).toBe("NEXT");
    });

    test("normalizes GOTO", () => {
      expect(normalizeKeyword("goto")).toBe("GOTO");
    });

  });

});

// ── normalizeTitle ───────────────────────────────────────────────────────────

describe("normalizeTitle", () => {

  test("is an alias for normalizeKeyword", () => {
    expect(normalizeTitle).toBe(normalizeKeyword);
  });

  test("produces same output as normalizeKeyword", () => {
    const inputs = [
      "apiResponseCode",
      "meta-data_key",
      "USER INPUTS",
      "toAchieve",
      "",
    ];
    for (const input of inputs) {
      expect(normalizeTitle(input)).toBe(normalizeKeyword(input));
    }
  });

});

// ── module contract ──────────────────────────────────────────────────────────

describe("module contract", () => {

  test("exports createNormalizeName", () => {
    expect(typeof createNormalizeName).toBe("function");
  });

  test("exports normalizeVariableName", () => {
    expect(typeof normalizeVariableName).toBe("function");
  });

  test("exports normalizeBlockName", () => {
    expect(typeof normalizeBlockName).toBe("function");
  });

  test("exports normalizeKeyword", () => {
    expect(typeof normalizeKeyword).toBe("function");
  });

  test("exports normalizeTitle", () => {
    expect(typeof normalizeTitle).toBe("function");
  });

  test("module exports are frozen", () => {
    const mod = require("../../../src/utilities/serialize/normalizeUtils");
    expect(Object.isFrozen(mod)).toBe(true);
  });

  test("module exports are non-extensible", () => {
    const mod = require("../../../src/utilities/serialize/normalizeUtils");
    expect(Object.isExtensible(mod)).toBe(false);
  });

});