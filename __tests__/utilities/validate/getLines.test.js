"use strict";

const getLines = require("../../../src/utilities/validate/getLines");

describe("getLines", () => {

  // ── Standard newline handling ───────────────────────────────────────────

  describe("standard newline handling", () => {

    test("splits LF (\\n) Unix/macOS line endings", () => {
      const content = "line1\nline2\nline3";
      const result = getLines(content);
      
      expect(result).toEqual(["line1", "line2", "line3"]);
      expect(result).toHaveLength(3);
    });

    test("splits CRLF (\\r\\n) Windows line endings", () => {
      const content = "line1\r\nline2\r\nline3";
      const result = getLines(content);
      
      expect(result).toEqual(["line1", "line2", "line3"]);
      expect(result).toHaveLength(3);
    });

    test("splits CR (\\r) legacy Mac line endings", () => {
      const content = "line1\rline2\rline3";
      const result = getLines(content);
      
      expect(result).toEqual(["line1", "line2", "line3"]);
      expect(result).toHaveLength(3);
    });

    test("handles mixed line endings in same content", () => {
      const content = "line1\nline2\r\nline3\rline4";
      const result = getLines(content);
      
      expect(result).toEqual(["line1", "line2", "line3", "line4"]);
      expect(result).toHaveLength(4);
    });

  });

  // ── Empty and edge cases ────────────────────────────────────────────────

  describe("empty and edge cases", () => {

    test("returns array with empty string for null input", () => {
      const result = getLines(null);
      
      expect(result).toEqual([""]);
    });

    test("returns array with empty string for undefined input", () => {
      const result = getLines(undefined);
      
      expect(result).toEqual([""]);
    });

    test("returns array with empty string for empty string input", () => {
      const result = getLines("");
      
      expect(result).toEqual([""]);
    });

    test("handles string with only newline character", () => {
      const result = getLines("\n");
      
      expect(result).toEqual(["", ""]);
    });

    test("handles string with only CRLF", () => {
      const result = getLines("\r\n");
      
      expect(result).toEqual(["", ""]);
    });

    test("handles string with only CR", () => {
      const result = getLines("\r");
      
      expect(result).toEqual(["", ""]);
    });

    test("handles string with multiple newlines only", () => {
      const result = getLines("\n\r\n\r");
      
      // \n, \r\n, \r
      expect(result).toEqual(["", "", "", ""]);
    });

    test("handles string starting with newline", () => {
      const content = "\nline1\nline2";
      const result = getLines(content);
      
      expect(result).toEqual(["", "line1", "line2"]);
    });

    test("handles string ending with newline", () => {
      const content = "line1\nline2\n";
      const result = getLines(content);
      
      expect(result).toEqual(["line1", "line2", ""]);
    });

    test("handles string with newlines only at ends", () => {
      const content = "\nline1\n";
      const result = getLines(content);
      
      expect(result).toEqual(["", "line1", ""]);
    });

  });

  // ── Whitespace and content preservation ─────────────────────────────────

  describe("whitespace and content preservation", () => {

    test("preserves leading whitespace", () => {
      const content = "  indented line\n    more indent";
      const result = getLines(content);
      
      expect(result).toEqual(["  indented line", "    more indent"]);
    });

    test("preserves trailing whitespace", () => {
      const content = "line with trailing spaces   \nanother line  ";
      const result = getLines(content);
      
      expect(result).toEqual(["line with trailing spaces   ", "another line  "]);
    });

    test("preserves empty lines with spaces", () => {
      const content = "line1\n   \nline3";
      const result = getLines(content);
      
      expect(result).toEqual(["line1", "   ", "line3"]);
    });

    test("preserves tabs", () => {
      const content = "\tindented\twith\ttabs\n\t\tmultiple\ttabs";
      const result = getLines(content);
      
      expect(result).toEqual(["\tindented\twith\ttabs", "\t\tmultiple\ttabs"]);
    });

  });

  // ── Special characters and Unicode ──────────────────────────────────────

  describe("special characters and Unicode", () => {

    test("handles Unicode characters", () => {
      const content = "Hello 世界\nПривет мир\nこんにちは";
      const result = getLines(content);
      
      expect(result).toEqual(["Hello 世界", "Привет мир", "こんにちは"]);
    });

    test("handles emoji characters", () => {
      const content = "Line with 🚀\nLine with 💻\nLine with 🎉";
      const result = getLines(content);
      
      expect(result).toEqual(["Line with 🚀", "Line with 💻", "Line with 🎉"]);
    });

    test("handles special characters without breaking", () => {
      const content = "!@#$%^&*()\n~`[]{}|\\;:'\",.<>/?";
      const result = getLines(content);
      
      expect(result).toEqual(["!@#$%^&*()", "~`[]{}|\\;:'\",.<>/?"]);
    });

  });

  // ── Large content handling ──────────────────────────────────────────────

  describe("large content handling", () => {

    test("handles many lines efficiently", () => {
      const lineCount = 1000;
      const lines = Array.from({ length: lineCount }, (_, i) => `Line ${i}`);
      const content = lines.join("\n");
      
      const result = getLines(content);
      
      expect(result).toHaveLength(lineCount);
      expect(result[0]).toBe("Line 0");
      expect(result[lineCount - 1]).toBe(`Line ${lineCount - 1}`);
    });

    test("handles very long single line", () => {
      const longLine = "a".repeat(100000);
      const content = `${longLine}\n${longLine}`;
      
      const result = getLines(content);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(100000);
      expect(result[1]).toHaveLength(100000);
    });

  });

  // ── Real-world scenarios ────────────────────────────────────────────────

  describe("real-world scenarios", () => {

    test("handles file with mixed OS line endings", () => {
      const content = "#!/usr/bin/env node\nconst x = 1;\r\nfunction test() {\r  return true;\n}";
      const result = getLines(content);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toBe("#!/usr/bin/env node");
      expect(result[1]).toBe("const x = 1;");
      expect(result[2]).toBe("function test() {");
      expect(result[3]).toBe("  return true;\n}");
    });

    test("handles log file with various line endings", () => {
      const content = "2024-01-01 INFO: Started\n2024-01-01 DEBUG: Processing\r\n2024-01-01 ERROR: Failed\r2024-01-01 INFO: Ended";
      const result = getLines(content);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toContain("Started");
      expect(result[1]).toContain("Processing");
      expect(result[2]).toContain("Failed");
      expect(result[3]).toContain("Ended");
    });

    test("handles CSV data with embedded newlines", () => {
      const content = "id,name,value\n1,John,100\n2,Jane,200\r\n3,Bob,300\r4,Alice,400";
      const result = getLines(content);
      
      expect(result).toHaveLength(5);
      expect(result[0]).toBe("id,name,value");
      expect(result[4]).toBe("4,Alice,400");
    });

    test("handles source code with comments", () => {
      const content = "// Header comment\nfunction main() {\r\n  // Indented comment\n  return true;\r}";
      const result = getLines(content);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toBe("// Header comment");
      expect(result[1]).toBe("function main() {");
      expect(result[2]).toBe("  // Indented comment");
      expect(result[3]).toBe("  return true;\n}");
    });

  });

  // ── Regression tests ─────────────────────────────────────────────────────

  describe("regression tests", () => {

    test("creates empty line for consecutive newlines", () => {
      const content = "line1\n\nline3";
      const result = getLines(content);
      
      expect(result).toEqual(["line1", "", "line3"]);
      expect(result).toHaveLength(3);
    });

    test("handles consecutive CRLF correctly", () => {
      const content = "line1\r\n\r\nline3";
      const result = getLines(content);
      
      expect(result).toEqual(["line1", "", "line3"]);
    });

    test("handles consecutive CR correctly", () => {
      const content = "line1\r\rline3";
      const result = getLines(content);
      
      // \r\r creates: "line1" then "" then "line3"
      expect(result).toEqual(["line1", "", "line3"]);
    });

    test("handles mixed consecutive delimiters", () => {
      const content = "line1\n\r\nline3";
      const result = getLines(content);
      
      // \n then \r\n
      expect(result).toEqual(["line1", "", "line3"]);
    });

  });

  // ── Type safety ─────────────────────────────────────────────────────────

  describe("type safety", () => {

    test("always returns an array", () => {
      expect(Array.isArray(getLines(""))).toBe(true);
      expect(Array.isArray(getLines(null))).toBe(true);
      expect(Array.isArray(getLines(undefined))).toBe(true);
      expect(Array.isArray(getLines("text"))).toBe(true);
    });

    test("returns array of strings", () => {
      const result = getLines("line1\nline2");
      
      expect(result.every(line => typeof line === "string")).toBe(true);
    });

    test("handles non-string inputs gracefully", () => {
      // @ts-ignore - Testing runtime behavior with invalid input
      expect(() => getLines(123)).not.toThrow();
      // @ts-ignore
      expect(() => getLines({})).not.toThrow();
      // @ts-ignore
      expect(() => getLines([])).not.toThrow();
    });

  });

  // ── Documentation examples ──────────────────────────────────────────────

  describe("documentation examples", () => {

    test("matches Unix example in JSDoc", () => {
      const result = getLines("line1\nline2\nline3");
      
      expect(result).toEqual(["line1", "line2", "line3"]);
    });

    test("matches Windows example in JSDoc", () => {
      const result = getLines("line1\r\nline2\r\nline3");
      
      expect(result).toEqual(["line1", "line2", "line3"]);
    });

    test("matches legacy Mac example in JSDoc", () => {
      const result = getLines("line1\rline2\rline3");
      
      expect(result).toEqual(["line1", "line2", "line3"]);
    });

    test("matches mixed example in JSDoc", () => {
      const result = getLines("line1\nline2\r\nline3\rline4");
      
      expect(result).toEqual(["line1", "line2", "line3", "line4"]);
    });

  });

});