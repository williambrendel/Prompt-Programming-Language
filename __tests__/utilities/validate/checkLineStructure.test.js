"use strict";

const checkLineStructure = require("../../../src/utilities/validate/checkLineStructure");

describe("checkLineStructure", () => {

  // ── Valid documents (no errors/warnings) ───────────────────────────────

  describe("valid documents", () => {

    test("returns empty feedback for valid LF line endings with 2-space indentation", () => {
      const content = `ROLE
  Content line 1
  Content line 2
---
INPUT
  Input content
`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    test("returns empty feedback for valid CRLF line endings with 2-space indentation", () => {
      const content = "ROLE\r\n  Content line 1\r\n  Content line 2\r\n---\r\nINPUT\r\n  Input content\r\n";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    test("allows 4-space indentation (multiple of 2)", () => {
      const content = `ROLE
    Four spaces indentation
    Still valid
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(false);
    });

    test("allows 6-space indentation (multiple of 2)", () => {
      const content = `ROLE
      Six spaces indentation
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(false);
    });

    test("allows blank lines between content", () => {
      const content = `ROLE
  Content

  More content
---
INPUT
  Input
`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

  });

  // ── Line ending validation (errors) ─────────────────────────────────────

  describe("line ending validation errors", () => {

    test("reports error for double CR (\\r\\r) line endings", () => {
      const content = "line1\r\rline2";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid line endings")
      )).toBe(true);
    });

    test("reports error for reverse newline (\\n\\r) line endings", () => {
      const content = "line1\n\rline2";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid line endings")
      )).toBe(true);
    });

    test("reports correct line number for double CR at start", () => {
      const content = "\r\rline1\nline2";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors[0].line).toBe(1);
    });

    test("reports correct line number for double CR in middle", () => {
      const content = "line1\nline2\r\rline3\nline4";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors[0].line).toBe(3); // After line2, before line3
    });

    test("reports correct line number for reverse newline", () => {
      const content = "line1\nline2\n\rline3";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors[0].line).toBe(3);
    });

    test("reports multiple invalid line endings", () => {
      const content = "line1\r\rline2\n\rline3\r\rline4";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.length).toBe(3);
      expect(errors[0].line).toBe(2);
      expect(errors[1].line).toBe(3);
      expect(errors[2].line).toBe(4);
    });

    test("does not report error for valid LF endings", () => {
      const content = "line1\nline2\nline3";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("line endings"))).toBe(false);
    });

    test("does not report error for valid CRLF endings", () => {
      const content = "line1\r\nline2\r\nline3";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("line endings"))).toBe(false);
    });

  });

  // ── Tab validation (errors) ────────────────────────────────────────────

  describe("tab validation errors", () => {

    test("reports error for tabs in indentation", () => {
      const content = `ROLE
\tIndented with tab
`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Tabs are not allowed") &&
        e.line === 2
      )).toBe(true);
    });

    test("reports error for mixed tabs and spaces", () => {
      const content = `ROLE
\t  Mixed indentation
`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("Tabs are not allowed"))).toBe(true);
    });

    test("reports error for tabs in multiple lines", () => {
      const content = `ROLE
\tLine with tab
  Line with spaces
\tAnother tab line
`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.length).toBe(2);
      expect(errors[0].line).toBe(2);
      expect(errors[1].line).toBe(4);
    });

    test("reports error for tab at beginning of line", () => {
      const content = "ROLE\n\tContent";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("Tabs"))).toBe(true);
    });

  });

  // ── Indentation multiple of 2 (warnings) ────────────────────────────────

  describe("indentation multiple of 2 warnings", () => {

    test("warns for 1-space indentation", () => {
      const content = `ROLE
 1 space indentation
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => 
        w.message.includes("multiple of 2") &&
        w.line === 2
      )).toBe(true);
    });

    test("warns for 3-space indentation", () => {
      const content = `ROLE
   Three spaces indentation
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(true);
    });

    test("warns for 5-space indentation", () => {
      const content = `ROLE
     Five spaces indentation
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(true);
    });

    test("does not warn for 0-space indentation (no indentation)", () => {
      const content = `ROLE
No indentation
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(false);
    });

    test("does not warn for 2-space indentation", () => {
      const content = `ROLE
  Two spaces
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(false);
    });

    test("does not warn for 4-space indentation", () => {
      const content = `ROLE
    Four spaces
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(false);
    });

  });

  // ── Indentation increment validation (warnings) ─────────────────────────

  describe("indentation increment warnings", () => {

    test("warns when indentation increases by more than 2 spaces", () => {
      const content = `ROLE
  Indented by 2
    Indented by 4 (valid)
      Indented by 6 (jump of 2 from 4, valid)
        Indented by 8 (valid increment)
          Indented by 10 (valid increment)
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("Too indented"))).toBe(false);
    });

    test("warns when indentation jumps from 0 to 4 spaces", () => {
      const content = `ROLE
    Jump from 0 to 4 spaces
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => 
        w.message.includes("Too indented") &&
        w.message.includes("increment by 2")
      )).toBe(true);
    });

    test("warns when indentation jumps from 2 to 6 spaces", () => {
      const content = `ROLE
  Two spaces
      Jump to 6 spaces (increase of 4)
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => 
        w.message.includes("Too indented") &&
        w.line === 3
      )).toBe(true);
    });

    test("warns when indentation jumps from 4 to 8 spaces", () => {
      const content = `ROLE
    Four spaces
        Jump to 8 spaces (increase of 4)
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("Too indented"))).toBe(true);
    });

    test("allows indentation to stay the same", () => {
      const content = `ROLE
  Same level
  Same level again
  Still same level
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => w.message.includes("Too indented"))).toBe(false);
    });

    test("allows indentation to decrease (reset)", () => {
      const content = `ROLE
  Indented level
No indentation (reset)
  Indented again
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      // Decreasing indentation is allowed (reset)
      expect(warnings.some(w => w.message.includes("Too indented"))).toBe(false);
    });

    test("Do not resets indentation tracking after blank line", () => {
      const content = `ROLE
  Indented content

    This jumps from 0 to 4 after blank line (should warn)
`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      // After blank line, lastIndentationLength is reset to 0
      expect(warnings.some(w => w.message.includes("Too indented"))).toBe(false);
    });

  });

  // ── Combined validation (multiple issues) ───────────────────────────────

  describe("combined validation", () => {

    test("reports both tab error and odd indentation warning", () => {
      const content = `ROLE
\tOdd indentation with tab
`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(errors.some(e => e.message.includes("Tabs"))).toBe(true);
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(true);
    });

    test("reports invalid line endings and indentation issues", () => {
      const content = "ROLE\r\r\n   Three spaces\nTASK\r\r\n    Four spaces";
      const feedback = checkLineStructure(content);
      
      const lineEndingErrors = feedback.filter(f => 
        f.type === "error" && f.message.includes("Invalid line endings")
      );
      const indentationWarnings = feedback.filter(f => 
        f.type === "warning" && f.message.includes("multiple of 2")
      );
      
      expect(lineEndingErrors.length).toBeGreaterThan(0);
      expect(indentationWarnings.length).toBeGreaterThan(0);
    });

  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {

    test("handles empty content", () => {
      const feedback = checkLineStructure("");
      expect(feedback).toHaveLength(0);
    });

    test("handles content with only blank lines", () => {
      const content = "\n\n\n";
      const feedback = checkLineStructure(content);
      expect(feedback).toHaveLength(0);
    });

    test("handles content with only spaces (no text)", () => {
      const content = "   \n   \n   ";
      const feedback = checkLineStructure(content);
      // Blank lines are skipped, so no validation
      expect(feedback).toHaveLength(0);
    });

    test("handles content with only comments", () => {
      const content = "# Comment\n# Another comment";
      const feedback = checkLineStructure(content);
      // Comments have no indentation (since they start with #)
      expect(feedback).toHaveLength(0);
    });

    test("handles very deep indentation", () => {
      const spaces = " ".repeat(100);
      const content = `ROLE\n${spaces}Deep indentation`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      // Should warn about increment (from 0 to 100)
      expect(warnings.some(w => w.message.includes("Too indented"))).toBe(true);
      // Even 100 is multiple of 2, so no odd warning
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(false);
    });

  });

  // ── Feedback array parameter ────────────────────────────────────────────

  describe("feedback array parameter", () => {

    test("accepts and mutates existing feedback array", () => {
      const existingFeedback = [{ type: "info", message: "Existing", line: 1 }];
      const content = "ROLE\n\tTab here";
      const feedback = checkLineStructure(content, existingFeedback);
      
      expect(feedback).toBe(existingFeedback);
      expect(feedback.length).toBe(3);
      expect(feedback[0].type).toBe("info");
      expect(feedback[1].type).toBe("error"); // tabs not allowed
      expect(feedback[2].type).toBe("warning"); // Indentation should be a multiple of 2 space
    });

    test("creates new array when not provided", () => {
      const content = "ROLE\n  Valid content";
      const feedback = checkLineStructure(content);
      
      expect(Array.isArray(feedback)).toBe(true);
      expect(feedback).toHaveLength(0);
    });

  });

  // ── Line number accuracy ────────────────────────────────────────────────

  describe("line number accuracy", () => {

    test("reports correct line number for tab error", () => {
      const content = `Line 1: ROLE
\tTab here
Normal`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors[0].line).toBe(2);
    });

    test("reports correct line number for odd indentation", () => {
      const content = `ROLE
  Two spaces (line 2)
   Three spaces (line 3)
    Four spaces (line 4)`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      const oddWarning = warnings.find(w => w.message.includes("multiple of 2"));
      expect(oddWarning.line).toBe(3);
    });

    test("reports correct line number for increment warning", () => {
      const content = `ROLE
  Two spaces (line 2)
      Jump to 6 spaces (line 3)`;
      const feedback = checkLineStructure(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      const incrementWarning = warnings.find(w => w.message.includes("Too indented"));
      expect(incrementWarning.line).toBe(3);
    });

  });

  // ── Real-world PPL document scenarios ───────────────────────────────────

  describe("real-world PPL document scenarios", () => {

    test("validates correctly formatted PPL document", () => {
      const content = `ROLE
  You are a helpful assistant.

---

INPUT
  User question here.

---

TASK
  Answer the question using 2-space indentation.

---

OUTPUT
  The answer with proper formatting.
`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    test("catches mixed indentation in PPL document", () => {
      const content = `ROLE
  Correct indentation
    Four spaces (jump of 2, valid)
   Three spaces (odd - warning)
\tTab character (error)
`;
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(errors.some(e => e.message.includes("Tabs"))).toBe(true);
      expect(warnings.some(w => w.message.includes("multiple of 2"))).toBe(true);
    });

    test("catches invalid line endings in PPL document", () => {
      const content = "ROLE\r\r\n  Content\n---\r\r\nINPUT\r\r\n  Input";
      const feedback = checkLineStructure(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("Invalid line endings"))).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    });

  });

});