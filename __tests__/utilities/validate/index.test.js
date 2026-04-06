"use strict";

const validate = require("../../../src/utilities/validate");

describe("validate (orchestration)", () => {

  // ── Basic orchestration ─────────────────────────────────────────────────

  describe("pipeline execution", () => {

    test("processes valid document without errors", () => {
      const content = `ROLE
  Content
---
INPUT
  Content
---
TASK
  Content
---
OUTPUT
  Content
`;
      const feedback = validate(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors).toHaveLength(0);
    });

    test("returns feedback array sorted by line number", () => {
      const content = `ROLE
   Three spaces (odd - line 2)
\tTab error (line 2)
INPUT
  Missing separator before INPUT (line 4)
`;
      const feedback = validate(content);
      
      // Verify sorted by line number
      for (let i = 1; i < feedback.length; i++) {
        const prevLine = feedback[i-1].line || 0;
        const currLine = feedback[i].line || 0;
        expect(prevLine).toBeLessThanOrEqual(currLine);
      }
    });

    test("handles null line numbers in sorting (UTF-8 errors first)", () => {
      // Create invalid UTF-8
      const invalidBuffer = Buffer.from([0xC0, 0x80]);
      const content = invalidBuffer.toString();
      
      const feedback = validate(content);
      
      // UTF-8 error has line: null → converted to 0, should be first
      expect(feedback[0].line).toBe(0);
      expect(feedback[0].message).toContain("not UTF8-encoded");
    });

  });

  // ── UTF-8 validation integration ────────────────────────────────────────

  describe("UTF-8 validation", () => {

    test("adds error for invalid UTF-8 content", () => {
      const invalidBuffer = Buffer.from([0xC0, 0x80]);
      const content = invalidBuffer.toString();
      
      const feedback = validate(content);
      const utf8Error = feedback.find(f => f.message === "Prompt is not UTF8-encoded");
      
      expect(utf8Error).toBeDefined();
      expect(utf8Error.type).toBe("error");
      expect(utf8Error.line).toBe(0);
    });

    test("allows valid UTF-8 content with emojis", () => {
      const content = `ROLE
  🚀 Emoji content
---
INPUT
  😀 Input
---
TASK
  Task
---
OUTPUT
  Output
`;
      const feedback = validate(content);
      const utf8Error = feedback.find(f => f.message === "Prompt is not UTF8-encoded");
      
      expect(utf8Error).toBeUndefined();
    });

  });

  // ── Multiple validator integration ──────────────────────────────────────

  describe("multiple validator integration", () => {

    test("collects errors from all validators", () => {
      const content = `ROLE
\tTab error (line 2)
INPUT
  Missing separator (line 3)
`;
      const feedback = validate(content);
      const errors = feedback.filter(f => f.type === "error");
      
      const hasTabError = errors.some(e => e.message.includes("Tabs are not allowed"));
      const hasMissingSeparator = errors.some(e => e.message.includes("Missing separator"));
      const hasMissingSections = errors.some(e => 
        e.message.includes("Missing") && (e.message.includes("OUTPUT") || e.message.includes("TASK"))
      );
      
      expect(hasTabError).toBe(true);
      expect(hasMissingSeparator).toBe(true);
      expect(hasMissingSections).toBe(true);
    });

    test("collects warnings from all validators", () => {
      const content = `ROLE
   Three spaces (odd - line 2)
  Two spaces (even - line 3)
   Another odd (line 4)
`;
      const feedback = validate(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      // Should have warnings for odd indentation (lines 2 and 4)
      expect(warnings.length).toBe(2);
      expect(warnings[0].line).toBe(2);
      expect(warnings[1].line).toBe(4);
    });

    test("continues validation even after UTF-8 error", () => {
      const invalidBuffer = Buffer.from([0xC0, 0x80]);
      const content = invalidBuffer.toString();
      
      const feedback = validate(content);
      
      // Should have UTF-8 error plus structure/section errors
      const utf8Error = feedback.some(f => f.message === "Prompt is not UTF8-encoded");
      const otherErrors = feedback.some(f => f.message.includes("Missing"));
      
      expect(utf8Error).toBe(true);
      expect(otherErrors).toBe(true);
    });

  });

  // ── Feedback array parameter ────────────────────────────────────────────

  describe("feedback array parameter", () => {

    test("accepts and mutates existing feedback array", () => {
      const existingFeedback = [{ type: "info", message: "Pre-check", line: 0 }];
      const content = `ROLE
  Content
---
INPUT
  Content
---
TASK
  Task
---
OUTPUT
  Output
`;
      const feedback = validate(content, existingFeedback);
      
      expect(feedback).toBe(existingFeedback);
      expect(feedback.length).toBeGreaterThan(1);
      expect(feedback[0].type).toBe("info");
    });

    test("creates new array when not provided", () => {
      const content = `ROLE
  Content
`;
      const feedback = validate(content);
      
      expect(Array.isArray(feedback)).toBe(true);
    });

    test("preserves existing non-validation feedback items", () => {
      const existingFeedback = [
        { type: "info", message: "Custom info", line: 0 },
        { type: "debug", message: "Debug data", line: 5 }
      ];
      const content = `ROLE
  Content
`;
      const feedback = validate(content, existingFeedback);
      
      expect(feedback.some(f => f.message === "Custom info")).toBe(true);
      expect(feedback.some(f => f.message === "Debug data")).toBe(true);
    });

  });

  // ── Feedback sorting (re-ordering) ────────────────────────────────────────

  describe("feedback sorting (re-ordering)", () => {

    test("returns feedback sorted by line number ascending", () => {
      const content = `ROLE
    Three spaces (line 2 - warning)
  \tTab error (line 2 - error)
  INPUT
    Missing separator (line 4 - error)
  `;
      const feedback = validate(content);
      const lineNumbers = feedback.map(f => f.line);
      
      for (let i = 1; i < lineNumbers.length; i++) {
        expect(lineNumbers[i-1]).toBeLessThanOrEqual(lineNumbers[i]);
      }
    });

    test("puts line:0 errors (UTF-8) at the beginning", () => {
      const invalidBuffer = Buffer.from([0xC0, 0x80]);
      const content = invalidBuffer.toString();
      const feedback = validate(content);
      
      expect(feedback[0].line).toBe(0);
      expect(feedback[0].message).toContain("not UTF8-encoded");
    });

    test("sorts mixed line numbers correctly", () => {
      const invalidBuffer = Buffer.from([0xC0, 0x80]);
      const content = invalidBuffer.toString() + `ROLE
    Three spaces
  INPUT
    Missing separator
  `;
      const feedback = validate(content);
      const lineNumbers = feedback.map(f => f.line);
      const sorted = [...lineNumbers].sort((a, b) => a - b);
      
      expect(lineNumbers).toEqual(sorted);
    });

    test("maintains order for same line numbers", () => {
      const content = `ROLE
    Three spaces (warning)
  \tTab error (error)
  `;
      const feedback = validate(content);
      const line2Feedback = feedback.filter(f => f.line === 2);
      
      expect(line2Feedback.length).toBe(2);
    });

    test("handles null/undefined line numbers as 0 for sorting", () => {
      const invalidBuffer = Buffer.from([0xC0, 0x80]);
      const content = invalidBuffer.toString();
      const feedback = validate(content);
      
      const zeroLineErrors = feedback.filter(f => f.line === 0);
      const positiveLineErrors = feedback.filter(f => f.line > 0);
      
      expect(zeroLineErrors.length).toBeGreaterThan(0);
      
      // All zero-line errors should come first
      if (positiveLineErrors.length > 0) {
        const lastZeroIndex = feedback.findLastIndex(f => f.line === 0);
        const firstPositiveIndex = feedback.findIndex(f => f.line > 0);
        expect(lastZeroIndex).toBeLessThan(firstPositiveIndex);
      }
    });

  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {

    test("handles empty content", () => {
      const feedback = validate("");
      const errors = feedback.filter(f => f.type === "error");
      
      // Should have empty prompt error
      expect(errors.some(e => e.message.includes("Empty prompt"))).toBe(true);
    });

    test("handles content with only comments", () => {
      const content = `# Comment 1
# Comment 2`;
      const feedback = validate(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("Empty prompt"))).toBe(true);
    });

    test("handles content with only whitespace", () => {
      const content = "   \n   \n   ";
      const feedback = validate(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("Empty prompt"))).toBe(true);
    });

    test("handles null content", () => {
      const feedback = validate(null);
      
      expect(Array.isArray(feedback)).toBe(true);
    });

    test("handles undefined content", () => {
      const feedback = validate(undefined);
      
      expect(Array.isArray(feedback)).toBe(true);
    });

  });

  // ── Real-world integration scenarios ────────────────────────────────────

  describe("real-world integration scenarios", () => {

    test("validates complete correct PPL document", () => {
      const content = `ROLE
  You are a code reviewer.

---

INPUT
  function add(a, b) { return a + b; }

---

TASK
  Review the code for bugs.

---

OUTPUT
  List of issues found.
`;
      const feedback = validate(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors).toHaveLength(0);
    });

    test("catches multiple structural issues in one document", () => {
      const content = `ROLE
\tTab indentation (error)
   Three spaces (warning)
INPUT
  Missing separator (error)
`;
      const feedback = validate(content);
      
      const hasTabError = feedback.some(f => f.type === "error" && f.message.includes("Tabs"));
      const hasOddWarning = feedback.some(f => f.type === "warning" && f.message.includes("multiple of 2"));
      const hasMissingSeparator = feedback.some(f => f.type === "error" && f.message.includes("Missing separator"));
      const hasMissingSections = feedback.some(f => f.type === "error" && f.message.includes("Missing"));
      
      expect(hasTabError).toBe(true);
      expect(hasOddWarning).toBe(true);
      expect(hasMissingSeparator).toBe(true);
      expect(hasMissingSections).toBe(true);
    });

  });

});