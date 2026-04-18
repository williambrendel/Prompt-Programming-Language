"use strict";

const {
  getBaseKeyword,
  getEndKeyword,
  getKeyword,
  isBaseKeyword,
  isEndKeyword,
  isKeyword,
  getBlockType,
  isBlockType,
  getTitle,
  isTitle,
  isVariable
} = require("../../src/utilities/nameUtils");

describe("nameUtils", () => {

  // ── getBaseKeyword / isBaseKeyword ──────────────────────────────────────────

  describe("getBaseKeyword", () => {

    describe("Standard matches", () => {
      test("returns uppercase keyword for exact uppercase input", () => {
        expect(getBaseKeyword("FOR")).toBe("FOR");
        expect(getBaseKeyword("IF")).toBe("IF");
        expect(getBaseKeyword("WHILE")).toBe("WHILE");
      });

      test("is case-insensitive", () => {
        expect(getBaseKeyword("foreach")).toBe("FOREACH");
        expect(getBaseKeyword("iF")).toBe("IF");
        expect(getBaseKeyword("Return")).toBe("RETURN");
      });

      test("handles multi-word keywords", () => {
        expect(getBaseKeyword("GO TO")).toBe("GO TO");
        expect(getBaseKeyword("else if")).toBe("ELSE IF");
        expect(getBaseKeyword("for each")).toBe("FOR EACH");
      });
    });

    describe("Does not match END* variants", () => {
      test("returns empty string for ENDIF — not a base keyword", () => {
        expect(getBaseKeyword("ENDIF")).toBe("");
      });

      test("returns empty string for ENDWHILE", () => {
        expect(getBaseKeyword("ENDWHILE")).toBe("");
      });
    });

    describe("Boundary and mismatch cases", () => {
      test("returns empty string for strings shorter than the shortest keyword", () => {
        expect(getBaseKeyword("A")).toBe("");
      });

      test("returns empty string for strings longer than the longest keyword", () => {
        expect(getBaseKeyword("VERY_LONG_NON_KEYWORD")).toBe("");
      });

      test("returns empty string for non-string types", () => {
        expect(getBaseKeyword(123)).toBe("");
        expect(getBaseKeyword(null)).toBe("");
        expect(getBaseKeyword(undefined)).toBe("");
      });

      test("returns empty string for valid strings that are not keywords", () => {
        expect(getBaseKeyword("APPLE")).toBe("");
        expect(getBaseKeyword("DEFINE_VAR")).toBe("");
      });
    });
  });

  describe("isBaseKeyword", () => {
    test("returns true for base keywords", () => {
      expect(isBaseKeyword("IF")).toBe(true);
      expect(isBaseKeyword("foreach")).toBe(true);
    });

    test("returns false for END* variants and non-keywords", () => {
      expect(isBaseKeyword("ENDIF")).toBe(false);
      expect(isBaseKeyword("APPLE")).toBe(false);
    });
  });

  // ── getEndKeyword / isEndKeyword ────────────────────────────────────────────

  describe("getEndKeyword", () => {

    describe("Standard END* matches", () => {
      test("matches ENDIF and normalizes to canonical form", () => {
        expect(getEndKeyword("ENDIF")).toBe("ENDIF");
        expect(getEndKeyword("END IF")).toBe("ENDIF");
        expect(getEndKeyword("END_IF")).toBe("ENDIF");
        expect(getEndKeyword("end if")).toBe("ENDIF");
        expect(getEndKeyword("end_if")).toBe("ENDIF");
      });

      test("matches ENDWHILE in all separator variants", () => {
        expect(getEndKeyword("ENDWHILE")).toBe("ENDWHILE");
        expect(getEndKeyword("END WHILE")).toBe("ENDWHILE");
        expect(getEndKeyword("END_WHILE")).toBe("ENDWHILE");
      });

      test("matches ENDFOR in all separator variants", () => {
        expect(getEndKeyword("ENDFOR")).toBe("ENDFOR");
        expect(getEndKeyword("END FOR")).toBe("ENDFOR");
        expect(getEndKeyword("END_FOR")).toBe("ENDFOR");
      });

      test("matches ENDLOOP", () => {
        expect(getEndKeyword("ENDLOOP")).toBe("ENDLOOP");
        expect(getEndKeyword("END_LOOP")).toBe("ENDLOOP");
      });
    });

    describe("Rejection cases", () => {
      test("returns empty string for plain keywords without END prefix", () => {
        expect(getEndKeyword("IF")).toBe("");
        expect(getEndKeyword("WHILE")).toBe("");
        expect(getEndKeyword("FOR")).toBe("");
      });

      test("returns empty string for END + non-keyword suffix", () => {
        expect(getEndKeyword("ENDAPPLE")).toBe("");
        expect(getEndKeyword("END BANANA")).toBe("");
      });

      test("returns empty string for non-string types", () => {
        expect(getEndKeyword(null)).toBe("");
        expect(getEndKeyword(undefined)).toBe("");
        expect(getEndKeyword(123)).toBe("");
      });
    });
  });

  describe("isEndKeyword", () => {
    test("returns true for END* keywords", () => {
      expect(isEndKeyword("ENDIF")).toBe(true);
      expect(isEndKeyword("end while")).toBe(true);
    });

    test("returns false for base keywords and non-keywords", () => {
      expect(isEndKeyword("IF")).toBe(false);
      expect(isEndKeyword("APPLE")).toBe(false);
    });
  });

  // ── getKeyword / isKeyword ──────────────────────────────────────────────────

  describe("getKeyword", () => {

    test("delegates to getEndKeyword first — END* takes priority", () => {
      expect(getKeyword("ENDIF")).toBe("ENDIF");
      expect(getKeyword("end while")).toBe("ENDWHILE");
    });

    test("falls back to getBaseKeyword for non-END keywords", () => {
      expect(getKeyword("IF")).toBe("IF");
      expect(getKeyword("foreach")).toBe("FOREACH");
      expect(getKeyword("GO TO")).toBe("GO TO");
    });

    test("returns empty string for non-keywords", () => {
      expect(getKeyword("APPLE")).toBe("");
      expect(getKeyword("ENDAPPLE")).toBe("");
      expect(getKeyword(null)).toBe("");
    });
  });

  describe("isKeyword", () => {
    test("returns true for base and END* keywords", () => {
      expect(isKeyword("IF")).toBe(true);
      expect(isKeyword("ENDIF")).toBe(true);
      expect(isKeyword("end for")).toBe(true);
    });

    test("returns false for non-keywords", () => {
      expect(isKeyword("APPLE")).toBe(false);
      expect(isKeyword("ENDAPPLE")).toBe(false);
    });
  });

  // ── getBlockType / isBlockType ──────────────────────────────────────────────

  describe("getBlockType", () => {

    describe("Standard matches", () => {
      test("returns uppercase block type for exact uppercase input", () => {
        expect(getBlockType("GOAL")).toBe("GOAL");
        expect(getBlockType("STEP")).toBe("STEP");
        expect(getBlockType("SUBSTEP")).toBe("SUBSTEP");
      });

      test("is case-sensitive", () => {
        expect(getBlockType("goal")).toBe("");
        expect(getBlockType("Goal")).toBe("");
        expect(getBlockType("GOAL")).toBe("GOAL");
      });
    });

    describe("Rejection cases", () => {
      test("returns empty string for non-block-type keywords", () => {
        expect(getBlockType("IF")).toBe("");
        expect(getBlockType("DO")).toBe("");
        expect(getBlockType("NEXT")).toBe("");
      });

      test("returns empty string for arbitrary strings", () => {
        expect(getBlockType("ITEM")).toBe("");
        expect(getBlockType("ACTION")).toBe("");
      });

      test("returns empty string for non-string types", () => {
        expect(getBlockType(null)).toBe("");
        expect(getBlockType(undefined)).toBe("");
        expect(getBlockType(123)).toBe("");
      });
    });
  });

  describe("isBlockType", () => {
    test("returns true for block types", () => {
      expect(isBlockType("GOAL")).toBe(true);
      expect(isBlockType("goal")).toBe(false);
    });

    test("returns false for non-block types", () => {
      expect(isBlockType("IF")).toBe(false);
      expect(isBlockType("ACTION")).toBe(false);
    });
  });

  // ── getTitle / isTitle ──────────────────────────────────────────────────────

  describe("getTitle", () => {
    test("returns the original string for valid titles", () => {
      expect(getTitle("USER INPUTS")).toBe("USER INPUTS");
      expect(getTitle("TO ACHIEVE")).toBe("TO ACHIEVE");
      expect(getTitle("GOAL")).toBe("GOAL");
      expect(getTitle("MY_CONSTANT")).toBe("MY_CONSTANT");
    });

    test("returns empty string for non-titles", () => {
      expect(getTitle("myVar")).toBe("");
      expect(getTitle("Goal")).toBe("");
      expect(getTitle("")).toBe("");
      expect(getTitle(null)).toBe("");
    });
  });

  describe("isTitle", () => {

    describe("Valid titles", () => {
      test("accepts all-uppercase words", () => {
        expect(isTitle("TITLE")).toBe(true);
        expect(isTitle("GOAL")).toBe(true);
        expect(isTitle("USER INPUTS")).toBe(true);
      });

      test("accepts uppercase with underscores and digits", () => {
        expect(isTitle("MY_CONSTANT")).toBe(true);
        expect(isTitle("STEP_100")).toBe(true);
      });

      test("accepts uppercase with spaces (space = char 32, within limit)", () => {
        expect(isTitle("TO ACHIEVE")).toBe(true);
        expect(isTitle("FOR EACH")).toBe(true);
      });
    });

    describe("Invalid titles", () => {
      test("rejects strings starting with a lowercase letter (charCode > 96)", () => {
        expect(isTitle("aTITLE")).toBe(false);
        expect(isTitle("title")).toBe(false);
      });

      test("rejects strings containing any lowercase letter (charCode > 95)", () => {
        expect(isTitle("TITLE_a")).toBe(false);
        expect(isTitle("TITLe")).toBe(false);
      });

      test("rejects strings with symbols whose char code exceeds 95 (e.g. { | } ~)", () => {
        expect(isTitle("TITLE{")).toBe(false);
        expect(isTitle("TITLE~")).toBe(false);
      });

      test("rejects strings with no uppercase letters (digits and symbols only)", () => {
        expect(isTitle("123_456")).toBe(false);
        expect(isTitle("!!!")).toBe(false);
      });

      test("rejects empty string, null, and undefined", () => {
        expect(isTitle("")).toBe(false);
        expect(isTitle(null)).toBe(false);
        expect(isTitle(undefined)).toBe(false);
      });
    });
  });

  // ── isVariable ──────────────────────────────────────────────────────────────

  describe("isVariable", () => {

    describe("Input patterns", () => {
      test("accepts 'input' (length 5)", () => {
        expect(isVariable("input")).toBe(true);
        expect(isVariable("INPUT")).toBe(true);
      });

      test("accepts 'inputs' (length 6)", () => {
        expect(isVariable("inputs")).toBe(true);
      });

      test("rejects 'input_x' (length 7 — exceeds input limit)", () => {
        expect(isVariable("input_x")).toBe(false);
      });
    });

    describe("Output patterns", () => {
      test("accepts 'output' (length 6)", () => {
        expect(isVariable("output")).toBe(true);
      });

      test("accepts 'outputs' (length 7)", () => {
        expect(isVariable("outputs")).toBe(true);
        expect(isVariable("OUTPUTS")).toBe(true);
      });

      test("rejects 'output_x' (length 8 — exceeds output limit)", () => {
        expect(isVariable("output_x")).toBe(false);
      });
    });

    describe("Rejection cases", () => {
      test("rejects strings that are too short (length <= 4)", () => {
        expect(isVariable("in")).toBe(false);
        expect(isVariable("out")).toBe(false);
      });

      test("rejects unrelated names regardless of prefix overlap", () => {
        expect(isVariable("myVar")).toBe(false);
        expect(isVariable("data_input")).toBe(false);
      });

      test("rejects non-string types", () => {
        expect(isVariable(null)).toBe(false);
        expect(isVariable(12345)).toBe(false);
        expect(isVariable(undefined)).toBe(false);
      });
    });
  });

});