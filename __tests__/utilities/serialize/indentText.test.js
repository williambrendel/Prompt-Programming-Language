"use strict";

const indentText = require("../../../src/utilities/serialize/indentText");

describe("indentText", () => {

  // ── Falsy input ─────────────────────────────────────────────────────────

  describe("falsy input", () => {

    test("returns empty string for empty string", () => {
      expect(indentText("")).toBe("");
    });

    test("returns empty string for null", () => {
      expect(indentText(null)).toBe("");
    });

    test("returns empty string for undefined", () => {
      expect(indentText(undefined)).toBe("");
    });

    test("returns empty string for 0", () => {
      expect(indentText(0)).toBe("");
    });

    test("returns empty string for false", () => {
      expect(indentText(false)).toBe("");
    });

  });

  // ── Single line ─────────────────────────────────────────────────────────

  describe("single line", () => {

    test("indents first line with default indent", () => {
      expect(indentText("hello")).toBe("  hello");
    });

    test("indents with custom indent string", () => {
      expect(indentText("hello", "    ")).toBe("    hello");
    });

    test("indents with tab character", () => {
      expect(indentText("hello", "\t")).toBe("\thello");
    });

    test("returns unchanged text when indent is empty string", () => {
      expect(indentText("hello", "")).toBe("hello");
    });

    test("skips first line indent when indentFirstLine=false", () => {
      expect(indentText("hello", "  ", false)).toBe("hello");
    });

  });

  // ── Multiline ───────────────────────────────────────────────────────────

  describe("multiline", () => {

    test("indents all lines with default indent", () => {
      expect(indentText("hello\nworld")).toBe("  hello\n  world");
    });

    test("indents three lines", () => {
      expect(indentText("a\nb\nc")).toBe("  a\n  b\n  c");
    });

    test("indents all lines with custom indent", () => {
      expect(indentText("a\nb", "    ")).toBe("    a\n    b");
    });

    test("skips first line only when indentFirstLine=false", () => {
      expect(indentText("hello\nworld", "  ", false)).toBe("hello\n  world");
    });

    test("skips first line only across three lines when indentFirstLine=false", () => {
      expect(indentText("a\nb\nc", "  ", false)).toBe("a\n  b\n  c");
    });

    test("stacks on top of already indented text", () => {
      expect(indentText("  hello\n  world", "  ")).toBe("    hello\n    world");
    });

  });

  // ── Trailing newlines ───────────────────────────────────────────────────

  describe("trailing newlines", () => {

    test("preserves trailing newline without indenting it", () => {
      expect(indentText("hello\n", "  ")).toBe("  hello\n");
    });

    test("preserves multiple trailing newlines without indenting them", () => {
      expect(indentText("hello\n\n", "  ")).toBe("  hello\n\n");
    });

  });

  // ── Leading newlines ────────────────────────────────────────────────────

  describe("leading newlines", () => {

    test("indents character after leading newline", () => {
      expect(indentText("\nhello", "  ")).toBe("  \n  hello");
    });

    test("skips first line but indents after leading newline when indentFirstLine=false", () => {
      expect(indentText("\nhello", "  ", false)).toBe("\n  hello");
    });

  });

  // ── Consecutive newlines ────────────────────────────────────────────────

  describe("consecutive newlines", () => {

    test("preserves blank line between content unindented", () => {
      expect(indentText("a\n\nb", "  ")).toBe("  a\n\n  b");
    });

    test("preserves multiple blank lines between content", () => {
      expect(indentText("a\n\n\nb", "  ")).toBe("  a\n\n\n  b");
    });

    test("indents only lines with content", () => {
      expect(indentText("a\n\nb\n\nc", "  ")).toBe("  a\n\n  b\n\n  c");
    });

  });

  // ── Special characters ──────────────────────────────────────────────────

  describe("special characters", () => {

    test("handles CRLF line endings", () => {
      expect(indentText("a\r\nb", "  ")).toBe("  a\r\n  b");
    });

    test("handles unicode characters", () => {
      expect(indentText("héllo\nwörld", "  ")).toBe("  héllo\n  wörld");
    });

    test("handles CJK characters", () => {
      expect(indentText("你好\n世界", "  ")).toBe("  你好\n  世界");
    });

    test("handles emoji characters", () => {
      expect(indentText("🚀\n🌍", "  ")).toBe("  🚀\n  🌍");
    });

    test("handles $variable sigils", () => {
      expect(indentText("$question\n$answer", "  ")).toBe("  $question\n  $answer");
    });

    test("handles @step sigils", () => {
      expect(indentText("@embed\n@search_kb", "  ")).toBe("  @embed\n  @search_kb");
    });

  });

  // ── PPL2 document scenarios ─────────────────────────────────────────────

  describe("PPL2 document scenarios", () => {

    test("indents a DO block correctly", () => {
      const block = "- tokenize $question\n- project into vector space\n- normalize embedding";
      expect(indentText(block, "  ")).toBe(
        "  - tokenize $question\n  - project into vector space\n  - normalize embedding"
      );
    });

    test("indents nested STEP block", () => {
      const block = "description: query knowledge base\ninputs[1]: [$question]\noutputs[1]: [$results]";
      expect(indentText(block, "    ")).toBe(
        "    description: query knowledge base\n    inputs[1]: [$question]\n    outputs[1]: [$results]"
      );
    });

    test("preserves blank lines in constraints block", () => {
      const block = "constraints:\n  - k=3 minimum results\n\n  - filter below threshold";
      expect(indentText(block, "  ")).toBe(
        "  constraints:\n    - k=3 minimum results\n\n    - filter below threshold"
      );
    });

    test("handles indentFirstLine=false for inline content after header", () => {
      const block = "research assistant";
      expect(indentText(block, "  ", false)).toBe("research assistant");
    });

  });

  // ── Module contract ─────────────────────────────────────────────────────

  describe("module contract", () => {

    test("exports a function", () => {
      expect(typeof indentText).toBe("function");
    });

    test("is frozen", () => {
      expect(Object.isFrozen(indentText)).toBe(true);
    });

    test("has self-referential indentText property", () => {
      expect(indentText.indentText).toBe(indentText);
    });

    test("self-referential property is non-writable", () => {
      const desc = Object.getOwnPropertyDescriptor(indentText, "indentText");
      expect(desc.writable).toBe(false);
    });

    test("self-referential property is non-configurable", () => {
      const desc = Object.getOwnPropertyDescriptor(indentText, "indentText");
      expect(desc.configurable).toBe(false);
    });

  });

});