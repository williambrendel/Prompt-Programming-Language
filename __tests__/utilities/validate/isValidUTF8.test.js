"use strict";

const isValidUTF8 = require("../../../src/utilities/validate/isValidUTF8");

describe("isValidUTF8", () => {

  // ── Basic string validation ─────────────────────────────────────────────

  describe("basic string validation", () => {

    test("returns true for ASCII string", () => {
      expect(isValidUTF8("Hello World")).toBe(true);
      expect(isValidUTF8("ABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe(true);
      expect(isValidUTF8("abcdefghijklmnopqrstuvwxyz")).toBe(true);
      expect(isValidUTF8("0123456789")).toBe(true);
    });

    test("returns true for string with punctuation", () => {
      expect(isValidUTF8("!@#$%^&*()_+-=[]{}|;:',.<>?/`~")).toBe(true);
    });

    test("returns true for empty string", () => {
      expect(isValidUTF8("")).toBe(true);
    });

    test("returns true for string with spaces", () => {
      expect(isValidUTF8("   ")).toBe(true);
      expect(isValidUTF8("line1\nline2\tline3")).toBe(true);
    });

  });

  // ── Unicode and multi-byte characters ───────────────────────────────────

  describe("Unicode and multi-byte characters", () => {

    test("returns true for UTF-8 encoded Unicode string", () => {
      expect(isValidUTF8("Hello 世界")).toBe(true);
      expect(isValidUTF8("Привет мир")).toBe(true);
      expect(isValidUTF8("こんにちは")).toBe(true);
      expect(isValidUTF8("안녕하세요")).toBe(true);
    });

    test("returns true for emoji characters", () => {
      expect(isValidUTF8("🚀")).toBe(true);
      expect(isValidUTF8("Hello 🚀 World")).toBe(true);
      expect(isValidUTF8("😀😃😄😁😆")).toBe(true);
      expect(isValidUTF8("👨‍👩‍👧‍👦")).toBe(true); // Family emoji (ZWNJ sequence)
    });

    test("returns true for accented characters", () => {
      expect(isValidUTF8("café")).toBe(true);
      expect(isValidUTF8("résumé")).toBe(true);
      expect(isValidUTF8("piñata")).toBe(true);
      expect(isValidUTF8("façade")).toBe(true);
    });

    test("returns true for mathematical symbols", () => {
      expect(isValidUTF8("∑∏∫√∞")).toBe(true);
      expect(isValidUTF8("αβγδεζη")).toBe(true);
    });

    test("returns true for currency symbols", () => {
      expect(isValidUTF8("$€£¥¢₮₨₩₪₫₭₱₲₴₵₹")).toBe(true);
    });

    test("returns true for CJK characters", () => {
      expect(isValidUTF8("汉字")).toBe(true);
      expect(isValidUTF8("𠀀")).toBe(true); // CJK Unified Ideograph Extension B (4-byte)
      expect(isValidUTF8("𠜎𠝹𠱓𠵈𡃁")).toBe(true);
    });

  });

  // ── Buffer validation ───────────────────────────────────────────────────

  describe("buffer validation", () => {

    test("returns true for valid UTF-8 Buffer", () => {
      const buf = Buffer.from("Hello World", "utf8");
      expect(isValidUTF8(buf)).toBe(true);
    });

    test("returns true for Buffer with Unicode", () => {
      const buf = Buffer.from("Hello 世界", "utf8");
      expect(isValidUTF8(buf)).toBe(true);
    });

    test("returns true for Buffer with emoji", () => {
      const buf = Buffer.from("🚀 Rocket", "utf8");
      expect(isValidUTF8(buf)).toBe(true);
    });

    test("returns true for empty Buffer", () => {
      const buf = Buffer.alloc(0);
      expect(isValidUTF8(buf)).toBe(true);
    });

  });

  // ── Invalid UTF-8 sequences ─────────────────────────────────────────────

  describe("invalid UTF-8 sequences", () => {

    test("returns false for incomplete multi-byte character", () => {
      // 3-byte character (€ = 0xE2 0x82 0xAC), missing last byte
      const invalidBuffer = Buffer.from([0xE2, 0x82]);
      expect(isValidUTF8(invalidBuffer)).toBe(false);
    });

    test("returns false for overlong encoding", () => {
      // 'A' (ASCII 0x41) overlong encoded as 2-byte sequence
      const overlong = Buffer.from([0xC1, 0x81]);
      expect(isValidUTF8(overlong)).toBe(false);
    });

    test("returns false for invalid continuation byte", () => {
      // Start of 2-byte char followed by invalid byte
      const invalid = Buffer.from([0xC2, 0x00]);
      expect(isValidUTF8(invalid)).toBe(false);
    });

    test("returns false for lone continuation byte", () => {
      const loneContinuation = Buffer.from([0x80]);
      expect(isValidUTF8(loneContinuation)).toBe(false);
    });

    test("returns false for invalid start byte", () => {
      // 0xF5 is invalid in UTF-8 (max is 0xF4)
      const invalidStart = Buffer.from([0xF5, 0x80, 0x80, 0x80]);
      expect(isValidUTF8(invalidStart)).toBe(false);
    });

    test("returns false for byte sequence that is too long", () => {
      // 5-byte sequence (invalid in UTF-8)
      const tooLong = Buffer.from([0xF8, 0x80, 0x80, 0x80, 0x80]);
      expect(isValidUTF8(tooLong)).toBe(false);
    });

    test("returns false for surrogate halves", () => {
      // UTF-16 surrogate half (invalid in UTF-8)
      const surrogate = Buffer.from([0xED, 0xA0, 0x80]); // U+D800
      expect(isValidUTF8(surrogate)).toBe(false);
    });

    test("returns false for null bytes in middle of string", () => {
      const nullByte = Buffer.from([0x48, 0x65, 0x00, 0x6C, 0x6C, 0x6F]);
      expect(isValidUTF8(nullByte)).toBe(false);
    });

  });

  // ── Edge cases and boundaries ───────────────────────────────────────────

  describe("edge cases and boundaries", () => {

    test("returns true for valid 1-byte UTF-8 (ASCII range)", () => {
      for (let i = 0x00; i <= 0x7F; i++) {
        const buf = Buffer.from([i]);
        expect(isValidUTF8(buf)).toBe(true);
      }
    });

    test("returns true for valid 2-byte UTF-8", () => {
      // Latin small letter a with grave (U+00E0) = 0xC3 0xA0
      const valid2Byte = Buffer.from([0xC3, 0xA0]);
      expect(isValidUTF8(valid2Byte)).toBe(true);
    });

    test("returns true for valid 3-byte UTF-8", () => {
      // Euro sign (U+20AC) = 0xE2 0x82 0xAC
      const valid3Byte = Buffer.from([0xE2, 0x82, 0xAC]);
      expect(isValidUTF8(valid3Byte)).toBe(true);
    });

    test("returns true for valid 4-byte UTF-8", () => {
      // Musical G clef (U+1D11E) = 0xF0 0x9D 0x84 0x9E
      const valid4Byte = Buffer.from([0xF0, 0x9D, 0x84, 0x9E]);
      expect(isValidUTF8(valid4Byte)).toBe(true);
    });

    test("handles very large valid string", () => {
      const largeString = "a".repeat(100000) + "世界".repeat(10000);
      expect(isValidUTF8(largeString)).toBe(true);
    });

    test("handles very large invalid buffer", () => {
      const largeInvalid = Buffer.alloc(100000, 0x80); // All continuation bytes
      expect(isValidUTF8(largeInvalid)).toBe(false);
    });

  });

  // ── Input type coercion ─────────────────────────────────────────────────

  describe("input type coercion", () => {

    test("handles non-string non-buffer inputs (coerces to string)", () => {
      // @ts-ignore - Testing runtime behavior
      expect(isValidUTF8(123)).toBe(true);
      // @ts-ignore
      expect(isValidUTF8(true)).toBe(true);
      // @ts-ignore
      expect(isValidUTF8(null)).toBe(true);
      // @ts-ignore
      expect(isValidUTF8(undefined)).toBe(true);
      // @ts-ignore
      expect(isValidUTF8({})).toBe(true); // [object Object] is valid UTF-8
    });

    test("handles number 0 correctly", () => {
      // @ts-ignore
      expect(isValidUTF8(0)).toBe(true);
    });

    test("handles boolean false correctly", () => {
      // @ts-ignore
      expect(isValidUTF8(false)).toBe(true);
    });

  });

  // ── Real-world PPL document scenarios ───────────────────────────────────

  describe("real-world PPL document scenarios", () => {

    test("returns true for typical PPL document", () => {
      const pplContent = `
ROLE
  You are a helpful assistant.

---

INPUT
  User question here.

---

TASK
  Answer the question.

---

OUTPUT
  The answer.
`;
      expect(isValidUTF8(pplContent)).toBe(true);
    });

    test("returns true for PPL document with Unicode in content", () => {
      const pplContent = `
ROLE
  你是一个有帮助的助手。

---

INPUT
  用户的问题是：${"你好世界"}

---

TASK
  回答问题。

---

OUTPUT
  答案。
`;
      expect(isValidUTF8(pplContent)).toBe(true);
    });

    test("returns true for PPL document with emojis", () => {
      const pplContent = `
ROLE
  You are a 🚀 expert.

---

TASK
  Explain how to use 😀 emojis.

---

OUTPUT
  📝 Emoji guide here.
`;
      expect(isValidUTF8(pplContent)).toBe(true);
    });

  });

  // ── Regression tests ────────────────────────────────────────────────────

  describe("regression tests", () => {

    test("handles BOM (Byte Order Mark) correctly", () => {
      // UTF-8 BOM is optional and valid
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      expect(isValidUTF8(bom)).toBe(true);
      
      const bomWithText = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
      expect(isValidUTF8(bomWithText)).toBe(true);
    });

    test("handles zero-width characters", () => {
      // Zero-width joiner (U+200D)
      const zwj = Buffer.from([0xE2, 0x80, 0x8D]);
      expect(isValidUTF8(zwj)).toBe(true);
      
      // Zero-width space (U+200B)
      const zws = Buffer.from([0xE2, 0x80, 0x8B]);
      expect(isValidUTF8(zws)).toBe(true);
    });

    test("handles replacement character correctly", () => {
      // U+FFFD replacement character
      const replacementChar = Buffer.from([0xEF, 0xBF, 0xBD]);
      expect(isValidUTF8(replacementChar)).toBe(true);
    });

  });

  // ── Performance and benchmarking notes ──────────────────────────────────

  describe("performance characteristics", () => {

    test("handles large valid string within reasonable time", () => {
      const start = Date.now();
      const largeString = "Hello World ".repeat(100000);
      const result = isValidUTF8(largeString);
      const duration = Date.now() - start;
      
      expect(result).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test("handles large invalid buffer within reasonable time", () => {
      const start = Date.now();
      const largeInvalid = Buffer.alloc(100000, 0xC0); // Invalid start bytes
      const result = isValidUTF8(largeInvalid);
      const duration = Date.now() - start;
      
      expect(result).toBe(false);
      expect(duration).toBeLessThan(1000);
    });

  });

});