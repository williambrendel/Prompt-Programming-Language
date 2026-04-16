"use strict";

const { tokenizeLines, tokenizeLine, normalizeLines } = require("../../../src/utilities/parse/tokenizeLines");

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const nocache = { useCache: false, clearCache: true };

/**
 * Structural matcher helper.
 * Ensures the object has the correct data and the toString method.
 */
const isLine = (val, ind, lev) => expect.objectContaining({
  value: val,
  indent: ind,
  level: lev,
  toString: expect.any(Function)
});

// ─── tokenizeLine ─────────────────────────────────────────────────────────────

describe("tokenizeLine", () => {

  describe("Metadata & Structure", () => {
    test("returns frozen objects with correct schema", () => {
      const [result] = tokenizeLine("  IF", "  ", nocache);
      expect(result).toEqual(isLine("IF", "  ", 2));
      expect(Object.isFrozen(result)).toBe(true);
      expect(result.toString()).toBe("  IF");
    });

    test("handles non-string values gracefully (coercion)", () => {
      // Accessing createLine directly for unit test if exported
      const { createLine } = tokenizeLine; 
      const line = createLine(100, "  ");
      expect(line.value).toBe("100");
    });
  });

  describe("Expansion Logic", () => {
    test("expands IF...THEN into multiple objects", () => {
      const result = tokenizeLine("IF x THEN y", "  ", nocache);
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual(isLine("IF", "", 0));
      expect(result[1]).toEqual(isLine("x", "  ", 2));
      expect(result[2]).toEqual(isLine("THEN", "", 0));
      expect(result[3]).toEqual(isLine("y", "  ", 2));
    });

    test("nested control flow depth calculation", () => {
      const result = tokenizeLine("IF x THEN IF y THEN z", "  ", nocache);
      // Levels: IF(0), x(2), THEN(0), IF(2), y(4), THEN(2), z(4)
      expect(result[4]).toEqual(isLine("y", "    ", 4));
      expect(result[5]).toEqual(isLine("THEN", "  ", 2));
    });

    test("Action keywords (GOTO) trigger proper slicing", () => {
      const result = tokenizeLine("IF x THEN GOTO @label", "  ", nocache);
      // IF(0), x(2), THEN(0), GOTO(2), @label(4)
      expect(result[3]).toEqual(isLine("GOTO", "  ", 2));
      expect(result[4]).toEqual(isLine("@label", "    ", 4));
    });
  });

  describe("Cache Behavior", () => {
    test("remaps indentation levels on cache hit", () => {
      const input = "IF x THEN y";
      // Prime cache with 0 base indent
      tokenizeLine(input, "  ", { useCache: true, clearCache: true });
      
      // Hit cache with 4-space base indent
      const result = tokenizeLine("    " + input, "  ", { useCache: true });
      
      expect(result[0]).toEqual(isLine("IF", "    ", 4));
      expect(result[1]).toEqual(isLine("x", "      ", 6));
    });
  });
});

// ─── tokenizeLines ───────────────────────────────────────────────────────────

describe("tokenizeLines", () => {
  test("flattens an array of lines into a single stream of objects", () => {
    const input = [
      "SET $x = 1",
      "IF $x THEN GOTO @end"
    ];
    const result = tokenizeLines(input, "  ", nocache);

    expect(result).toHaveLength(7);
    expect(result[0].value).toBe("SET");
    expect(result[1].value).toBe("$x = 1");
    expect(result[2].value).toBe("IF");
    expect(result[3].value).toBe("$x");
    expect(result[4].value).toBe("THEN");
    expect(result[5].value).toBe("GOTO");
    expect(result[6].value).toBe("@end");
  });

  test("preserve blank lines", () => {
    const input = [
      "SET $x = 1",
      "",
      " ",
      "IF $x THEN GOTO @end"
    ];
    const result = tokenizeLines(input, "  ", nocache);
    expect(result).toHaveLength(9);
    expect(result[1].value).toBe("$x = 1");
    expect(result[2].value).toBe("");
    expect(result[3].value).toBe("");
    expect(result[3].indent).toBe(" ");
    expect(result[3].level).toBe(1);
    expect(result[4].value).toBe("IF");
  });

  test("isolates base indentation between different lines", () => {
    const input = [
      "IF a THEN b",
      "  GOTO @target"
    ];
    const result = tokenizeLines(input, "  ", nocache);

    expect(result[0].level).toBe(0); // From first line
    expect(result[4].level).toBe(2); // From second line's original indent
  });

  test("returns empty array for invalid inputs", () => {
    expect(tokenizeLines(null)).toEqual([]);
    expect(tokenizeLines({})).toEqual([]);
  });
});

// ─── normalizeLines ──────────────────────────────────────────────────────────

describe("normalizeLines", () => {
  test("converts everything to a final array of indented strings", () => {
    const input = [
      "    IF x THEN GOTO @lab"
    ];
    const result = normalizeLines(input, "  ", nocache);

    expect(result).toEqual([
      "    IF",
      "      x",
      "    THEN",
      "      GOTO",
      "        @lab"
    ]);
    // Ensure they are primitives, not objects
    expect(typeof result[0]).toBe("string");
  });

  test("handles multiple mixed lines", () => {
    const input = [
      "CMD 1",
      "IF x THEN y"
    ];
    const result = normalizeLines(input, "  ", nocache);
    expect(result).toEqual(["CMD 1", "IF", "  x", "THEN", "  y"]);
  });
});