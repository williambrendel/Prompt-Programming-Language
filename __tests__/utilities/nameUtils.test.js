"use strict";

const { getKeyword, isKeyword, isTitle, isVariable } = require("../../src/utilities/nameUtils");

describe("nameUtils", () => {

  // ── Keyword Validation ──────────────────────────────────────────────────

  describe("getKeyword & isKeyword", () => {
    
    describe("Standard matches", () => {
      test("identifies exact uppercase keywords", () => {
        expect(getKeyword("FOR")).toBe("FOR");
        expect(isKeyword("WHILE")).toBe(true);
      });

      test("is case-insensitive", () => {
        expect(getKeyword("foreach")).toBe("FOREACH");
        expect(getKeyword("iF")).toBe("IF");
        expect(isKeyword("Return")).toBe(true);
      });

      test("handles keywords with spaces", () => {
        expect(getKeyword("GO TO")).toBe("GO TO");
        expect(isKeyword("else if")).toBe(true);
      });
    });

    describe("Boundary and mismatch cases", () => {
      test("returns false for strings shorter than the shortest keyword (IN/AS/OF/IF/TO)", () => {
        expect(getKeyword("A")).toBe("");
      });

      test("returns false for strings longer than the longest keyword (CONTINUE/EVALUATE/ITERATE)", () => {
        expect(getKeyword("VERY_LONG_NON_KEYWORD")).toBe("");
      });

      test("returns false for non-string types", () => {
        expect(getKeyword(123)).toBe("");
        expect(getKeyword(null)).toBe("");
      });

      test("returns false for valid strings that aren't keywords", () => {
        expect(isKeyword("APPLE")).toBe(false);
        expect(isKeyword("DEFINE_VAR")).toBe(false);
      });
    });
  });

  // ── Title Validation (Character Code Logic) ──────────────────────────────

  describe("isTitle", () => {

    test("returns true for valid uppercase titles", () => {
      expect(isTitle("TITLE")).toBe(true);
      expect(isTitle("MY_CONSTANT")).toBe(true);
      expect(isTitle("STEP_100")).toBe(true);
    });

    test("returns false if it starts with a lowercase letter (charCodeAt > 96)", () => {
      expect(isTitle("aTITLE")).toBe(false);
      expect(isTitle("title")).toBe(false);
    });

    test("returns false if it contains any lowercase letter (charCodeAt > 95)", () => {
      expect(isTitle("TITLE_a")).toBe(false);
      expect(isTitle("TI tLE")).toBe(false); // space is fine, but loop checks for > 95
    });

    test("returns false for symbols with char codes > 95 (like { | } ~ )", () => {
      expect(isTitle("TITLE{")).toBe(false);
    });

    test("requires at least one uppercase letter (65-90)", () => {
      // String with only symbols/numbers < 95 but no A-Z
      expect(isTitle("123_456")).toBe(false);
      expect(isTitle("!!!")).toBe(false);
    });

    test("handles edge case types", () => {
      expect(isTitle("")).toBe(false);
      expect(isTitle(null)).toBe(false);
      expect(isTitle(undefined)).toBe(false);
    });
  });

  // ── Variable Naming Conventions ──────────────────────────────────────────

  describe("isVariable", () => {

    describe("Input patterns", () => {
      test("accepts 'input' (length 5)", () => {
        expect(isVariable("input")).toBe(true);
        expect(isVariable("INPUT")).toBe(true);
      });

      test("accepts 'inputs' (length 6)", () => {
        expect(isVariable("inputs")).toBe(true);
      });

      test("rejects 'input12' (length 7, exceeds input limit < 7)", () => {
        expect(isVariable("input12")).toBe(false);
      });
    });

    describe("Output patterns", () => {
      test("accepts 'output' (length 6)", () => {
        expect(isVariable("output")).toBe(true);
      });

      test("accepts 'outputs' (length 7)", () => {
        expect(isVariable("outputs")).toBe(true);
        expect(isVariable("OUTputs")).toBe(true);
      });

      test("rejects 'output12' (length 8, exceeds limit < 8)", () => {
        expect(isVariable("output12")).toBe(false);
      });
    });

    describe("General rejection", () => {
      test("rejects strings too short (length <= 4)", () => {
        expect(isVariable("in")).toBe(false);
        expect(isVariable("out")).toBe(false);
      });

      test("rejects unrelated variable names", () => {
        expect(isVariable("myVar")).toBe(false);
        expect(isVariable("data_input")).toBe(false); // Doesn't start with input
      });

      test("handles non-string types", () => {
        expect(isVariable(null)).toBe(false);
        expect(isVariable(12345)).toBe(false);
      });
    });
  });

});