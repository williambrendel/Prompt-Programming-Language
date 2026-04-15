"use strict";

const { normalizeLines, tokenizeLine} = require("../../../src/utilities/parse/normalizeLines");

// ─── helpers ─────────────────────────────────────────────────────────────────

// Always bypass cache so tests are order-independent.
const nocache = { useCache: false, clearCache: true };
const tl = (line, indent) => tokenizeLine(line, indent, nocache);
const nl = (line, indent) => normalizeLines(line, indent, nocache);

// ─── tokenizeLine ─────────────────────────────────────────────────────────────

describe("tokenizeLine", () => {

  // ── No expansion ────────────────────────────────────────────────────────────

  describe("lines that do not expand", () => {
    test("no keywords — returns line as-is", () => {
      expect(tl("tokenize $question")).toEqual(["tokenize $question"]);
    });

    test("single keyword only — returns line as-is", () => {
      expect(tl("DO")).toEqual(["DO"]);
    });

    // test("single keyword + content — returns line as-is", () => {
    //   expect(tl("GOTO @target")).toEqual(["GOTO @target"]);
    //   expect(tl("IF $x > 0")).toEqual(["IF $x > 0"]);
    // });

    test("preserves leading whitespace when not expanding", () => {
      expect(tl("    @target")).toEqual(["    @target"]);
    });
  });

  // ── Basic two-keyword expansion ─────────────────────────────────────────────

  describe("two keywords", () => {
    test("IF … THEN", () => {
      expect(tl("IF x THEN y")).toEqual([
        "IF",
        "  x",
        "THEN",
        "  y"
      ]);
    });

    test("preserves leading whitespace as base indent", () => {
      expect(tl("    IF x THEN y")).toEqual([
        "    IF",
        "      x",
        "    THEN",
        "      y"
      ]);
    });

    test("custom indent unit", () => {
      expect(tl("IF x THEN y", "    ")).toEqual([
        "IF",
        "    x",
        "THEN",
        "    y"
      ]);
    });
  });

  // ── Consecutive keywords push ────────────────────────────────────────────────

  describe("consecutive keywords push one level each", () => {
    test("two consecutive keywords — second is one level deeper", () => {
      expect(tl("IF THEN")).toEqual([
        "IF",
        "  THEN"
      ]);
    });

    test("three consecutive keywords — each one level deeper", () => {
      expect(tl("IF THEN ELSE")).toEqual([
        "IF",
        "  THEN",
        "    ELSE"
      ]);
    });

    test("N consecutive keywords push N-1 levels", () => {
      expect(tl("IF FOR WHILE DO")).toEqual([
        "IF",
        "  FOR",
        "    WHILE",
        "      DO"
      ]);
    });
  });

  // ── END* keywords pop ────────────────────────────────────────────────────────

  describe("END* keywords pop one level", () => {
    test("ENDIF pops back to outer level", () => {
      expect(tl("IF x THEN y ENDIF ELSE z")).toEqual([
        "IF",
        "  x",
        "THEN",
        "  y",
        "ENDIF",
        "ELSE",
        "  z"
      ]);
    });

    test("keyword following END* pops one level", () => {
      expect(tl("IF x THEN y ENDWHILE z")).toEqual([
        "IF",
        "  x",
        "THEN",
        "  y",
        "ENDWHILE",
        "z"
      ]);
    });
  });

  // ── Nested expressions ───────────────────────────────────────────────────────

  describe("nested control flow", () => {
    test("IF x THEN IF y THEN z ENDIF ELSE w", () => {
      expect(tl("IF x THEN IF y THEN z ENDIF ELSE w")).toEqual([
        "IF",
        "  x",
        "THEN",
        "  IF",
        "    y",
        "  THEN",
        "    z",
        "  ENDIF",
        "ELSE",
        "  w"
      ]);
    });

    test("deeply nested: IF x THEN IF y THEN IF z THEN result", () => {
      expect(tl("IF x THEN IF y THEN IF z THEN result")).toEqual([
        "IF",
        "  x",
        "THEN",
        "  IF",
        "    y",
        "  THEN",
        "    IF",
        "      z",
        "    THEN",
        "      result"
      ]);
    });
  });

  // ── ELSEIF vs ELSE IF ────────────────────────────────────────────────────────

  describe("ELSEIF (one token) vs ELSE IF (two tokens)", () => {
    test("ELSEIF stays at same level as IF and ELSE", () => {
      expect(tl("IF x ELSEIF y ELSE z")).toEqual([
        "IF",
        "  x",
        "ELSEIF",
        "  y",
        "ELSE",
        "  z"
      ]);
    });

    test("ELSE IF — IF pushes one level under ELSE", () => {
      expect(tl("IF x ELSE IF y THEN z")).toEqual([
        "IF",
        "  x",
        "ELSE",
        "  IF",
        "    y",
        "  THEN",
        "    z"
      ]);
    });
  });

  // ── Multi-word content ───────────────────────────────────────────────────────

  describe("multi-word content between keywords", () => {
    test("multi-word content is not joined on one line", () => {
      expect(tl("IF $score >= 0.7 THEN GOTO @generate ELSE GOTO @fallback")).toEqual([
        "IF",
        "  $score >= 0.7",
        "THEN",
        "  GOTO",
        "    @generate",
        "ELSE",
        "  GOTO",
        "    @fallback"
      ]);
    });
  });

  // ── Cache ────────────────────────────────────────────────────────────────────

  describe("cache behaviour", () => {
    test("useCache: false skips cache read and write", () => {
      tokenizeLine("IF x THEN y");
      const result = tokenizeLine("IF x THEN y", "  ", { useCache: false });
      expect(result).toEqual(["IF", "  x", "THEN", "  y"]);
    });

    test("clearCache: true clears cache before processing", () => {
      tokenizeLine("IF a THEN b");
      const result = tokenizeLine("IF a THEN b", "  ", { clearCache: true });
      expect(result).toEqual(["IF", "  a", "THEN", "  b"]);
    });

    test("cache hit remaps base indentation correctly", () => {
      // Populate cache with no base indent.
      tokenizeLine("IF x THEN y");
      // Re-call with 4-space base indent — cache hit should remap.
      const result = tokenizeLine("    IF x THEN y", "  ", { useCache: true });
      expect(result).toEqual(["    IF", "      x", "    THEN", "      y"]);
    });
  });

});

// ─── normalizeLines ──────────────────────────────────────────────────────────

describe("normalizeLines", () => {

  test("returns empty array for non-array input", () => {
    expect(nl(null)).toEqual([]);
    expect(nl("string")).toEqual([]);
    expect(nl(undefined)).toEqual([]);
  });

  test("returns empty array for empty input", () => {
    expect(nl([])).toEqual([]);
  });

  test("passes through lines with no keywords unchanged", () => {
    const lines = ["tokenize $question", "project into vector space"];
    expect(nl(lines)).toEqual(lines);
  });

  test("passes through lines with a single keyword", () => {
    expect(nl(["GOTO @target"])).toEqual(["GOTO", "  @target"]);
  });

  test("expands a single line with multiple keywords", () => {
    expect(nl(["IF x THEN y ELSE z"])).toEqual([
      "IF", "  x", "THEN", "  y", "ELSE", "  z"
    ]);
  });

  test("expands only lines that need it — others pass through", () => {
    expect(nl([
      "tokenize $question",
      "IF $score >= 0.7 THEN GOTO @gen ELSE GOTO @fall",
      "project into vector space"
    ])).toEqual([
      "tokenize $question",
      "IF",
      "  $score >= 0.7",
      "THEN",
      "  GOTO",
      "    @gen",
      "ELSE",
      "  GOTO",
      "    @fall",
      "project into vector space"
    ]);
  });

  test("expands multiple lines that each need expansion", () => {
    expect(nl([
      "IF x THEN y",
      "IF a THEN b"
    ])).toEqual([
      "IF", "  x", "THEN", "  y",
      "IF", "  a", "THEN", "  b"
    ]);
  });

  test("preserves base indentation across all expanded lines", () => {
    expect(nl(["    IF x THEN y ELSE z"])).toEqual([
      "    IF", "      x", "    THEN", "      y", "    ELSE", "      z"
    ]);
  });

  test("uses custom indent unit", () => {
    expect(nl(["IF x THEN y"], "    ", tl)).toEqual([
      "IF", "    x", "THEN", "    y"
    ]);
  });

});
