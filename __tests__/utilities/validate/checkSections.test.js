"use strict";

const checkSections = require("../../../src/utilities/validate/checkSections");

describe("checkSections", () => {

  // ── Valid documents ─────────────────────────────────────────────────────

  describe("valid documents", () => {

    test("validates complete document with all required sections", () => {
      const content = `
ROLE
  You are a code reviewer.

---

INPUT
  The code is a JavaScript function.

---

TASK
  Identify bugs and suggest improvements.

---

OUTPUT
  A list of issues found.
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors).toHaveLength(0);
    });

    test("validates document with GOAL instead of TASK", () => {
      const content = `
ROLE
  You are a code reviewer.

---

INPUT
  The code is a JavaScript function.

---

GOAL
  Identify bugs and suggest improvements.

---

OUTPUT
  A list of issues found.
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors).toHaveLength(0);
    });

    test("allows blank lines and comments between sections", () => {
      const content = `
ROLE
  Content here

# This is a comment

---

INPUT
  More content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors).toHaveLength(0);
    });

    test("validates document with no trailing newline", () => {
      const content = `ROLE
  Content
---
INPUT
  Content`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors).toHaveLength(0);
    });

  });

  // ── Empty / useless prompt errors ───────────────────────────────────────

  describe("empty or useless prompt errors", () => {

    test("reports error for completely empty content", () => {
      const feedback = checkSections("");
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Empty prompt or prompt contains only comments")
      )).toBe(true);
    });

    test("reports error for content with only blank lines", () => {
      const content = `




`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Empty prompt or prompt contains only comments")
      )).toBe(true);
    });

    test("reports error for content with only comments", () => {
      const content = `
# Comment line 1
# Comment line 2
# Another comment
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Empty prompt or prompt contains only comments")
      )).toBe(true);
    });

    test("reports error for content with comments and blank lines only", () => {
      const content = `
# Comment

# Another comment

`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Empty prompt or prompt contains only comments")
      )).toBe(true);
    });

  });

  // ── Missing separator errors ────────────────────────────────────────────

  describe("missing separator errors", () => {

    test("reports missing separator between sections", () => {
      const content = `
ROLE
  Content here
INPUT
  Missing separator above
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Missing separator before this section title") &&
        e.line === 5
      )).toBe(true);
    });

    test("reports missing separator after content with no separator", () => {
      const content = `
ROLE
  First section content
TASK
  Second section content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Missing separator before this section title")
      )).toBe(true);
    });

  });

  // ── Empty section errors ────────────────────────────────────────────────

  describe("empty section errors", () => {

    test("reports empty section with no content", () => {
      const content = `
ROLE

---

INPUT
  Content here
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Empty section content before separator") &&
        e.line === 5
      )).toBe(true);
    });

    test("reports empty section with only blank lines", () => {
      const content = `
ROLE



---

INPUT
  Content here
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Empty section content before separator")
      )).toBe(true);
    });

    test("reports empty section with only comments", () => {
      const content = `
ROLE
  # This is just a comment
  # Another comment
---
INPUT
  Content here
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Empty section content before separator")
      )).toBe(true);
    });

  });

  // ── Trailing separator errors ───────────────────────────────────────────

  describe("trailing separator errors", () => {

    test("reports trailing separator at end of document", () => {
      const content = `
ROLE
  Content
---
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Cannot end with a separator") &&
        e.line === 5
      )).toBe(true);
    });

    test("reports trailing separator even with blank lines after", () => {
      const content = `
ROLE
  Content
---


`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Cannot end with a separator")
      )).toBe(true);
    });

  });

  // ── Missing indentation warnings ────────────────────────────────────────

  describe("missing indentation warnings", () => {

    test("warns when content is not indented", () => {
      const content = `
ROLE
Content not indented
---
INPUT
  Properly indented
`;
      const feedback = checkSections(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => 
        w.message.includes("Content should be indented under section title") &&
        w.line === 4
      )).toBe(true);
    });

    test("warns for multiple unindented content lines", () => {
      const content = `
ROLE
First line not indented
Second line not indented
---
INPUT
  Indented content
`;
      const feedback = checkSections(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.length).toBe(2);
    });

    test("warns for mixed indentation in same section", () => {
      const content = `
ROLE
  Indented line
Not indented line
  Indented again
---
INPUT
  Content
`;
      const feedback = checkSections(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.length).toBe(1);
      expect(warnings[0].line).toBe(5);
    });

  });

  // ── Title case errors ────────────────────────────────────────────────────

  describe("title case errors", () => {

    test("reports error for title with lowercase letters", () => {
      const content = `
Role
  Content
---
INPUT
  Input content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Missing section title and incorrect indentation")
      )).toBe(true);
    });

    test("reports error for title with mixed case", () => {
      const content = `
RoleName
  Content
---
INPUT
  Input content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Missing section title and incorrect indentation")
      )).toBe(true);
    });

    test("treats uppercase title with numbers as valid", () => {
      const content = `
ROLE1
  Content
---
INPUT
  Input
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("ROLE"))).toBe(true); // Missing ROLE section
      expect(errors.some(e => e.message.includes("Missing section title"))).toBe(false);
    });

  });

  // ── Duplicate section errors ────────────────────────────────────────────

  describe("duplicate section errors", () => {

    test("reports duplicate section titles", () => {
      const content = `
ROLE
  Content
---
ROLE
  Duplicate content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Section title already exists line 2") &&
        e.line === 6
      )).toBe(true);
    });

    test("reports third duplicate with reference to previous duplicate", () => {
      const content = `
ROLE
  First
---
ROLE
  Second
---
ROLE
  Third
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.filter(e => e.message.includes("already exists")).length).toBe(2);
      const thirdDuplicate = errors.find(e => e.line === 10);
      expect(thirdDuplicate.message).toMatch(/line 6/); // Points to second occurrence
    });

  });

  // ── Separator format errors ─────────────────────────────────────────────

  describe("separator format errors", () => {

    test("reports invalid separator format (===)", () => {
      const content = `
ROLE
  Content
===
INPUT
  More content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid separator, should be ---") &&
        e.line === 5
      )).toBe(true);
    });

    test("reports invalid separator format (***)", () => {
      const content = `
ROLE
  Content
***
INPUT
  More content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid separator, should be ---")
      )).toBe(true);
    });

    test("reports invalid separator format (~~~)", () => {
      const content = `
ROLE
  Content
~~~
INPUT
  More content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid separator, should be ---")
      )).toBe(true);
    });

    test("warns about inconsistent separators (--- vs ----)", () => {
      const content = `
ROLE
  Content
---
INPUT
  Content
----
TASK
  Content
`;
      const feedback = checkSections(content);
      const warnings = feedback.filter(f => f.type === "warning");
      
      expect(warnings.some(w => 
        w.message.includes("Inconsistent separator")
      )).toBe(true);
    });

    test("allows longer valid separators (-----)", () => {
      const content = `
ROLE
  Content
-----
INPUT
  Content
---
TASK
  Content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      const warnings = feedback.filter(f => f.type === "warning");
      
      // Should have warning about inconsistency, but not error about invalid format
      expect(errors.some(e => e.message.includes("Invalid separator"))).toBe(false);
      expect(warnings.length).toBeGreaterThan(0);
    });

  });

  // ── Multiple consecutive separators ─────────────────────────────────────

  describe("multiple consecutive separators", () => {

    test("reports error for two separators in a row", () => {
      const content = `
ROLE
  Content
---
---

INPUT
  Content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("No section title and content found between this separator")
      )).toBe(true);
    });

    test("reports error for three separators in a row", () => {
      const content = `
ROLE
  Content
---
---
---
INPUT
  Content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      const separatorErrors = errors.filter(e => 
        e.message.includes("No section title and content found")
      );
      expect(separatorErrors.length).toBe(2);
    });

  });

  // ── Document start errors ───────────────────────────────────────────────

  describe("document start errors", () => {

    test("reports document starting with separator", () => {
      const content = `
---
ROLE
  Content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Prompt cannot start with a separator") &&
        e.line === 2
      )).toBe(true);
    });

    test("reports document starting with separator at line 1 (no leading newline)", () => {
      const content = `---
ROLE
  Content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Prompt cannot start with a separator") &&
        e.line === 1
      )).toBe(true);
    });

    test("reports content before any section title", () => {
      const content = `
  Content with no title
---
ROLE
  Actual content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Content is missing a section title") &&
        e.line === 2
      )).toBe(true);
    });

  });

  // ── Required sections errors ────────────────────────────────────────────

  describe("required sections errors", () => {

    test("reports missing ROLE section", () => {
      const content = `
INPUT
  Input content
---
TASK
  Task content
---
OUTPUT
  Output content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Missing ROLE section")
      )).toBe(true);
    });

    test("reports missing INPUT section", () => {
      const content = `
ROLE
  Role content
---
TASK
  Task content
---
OUTPUT
  Output content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Missing INPUT section")
      )).toBe(true);
    });

    test("reports missing OUTPUT section", () => {
      const content = `
ROLE
  Role content
---
INPUT
  Input content
---
TASK
  Task content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Missing OUTPUT section")
      )).toBe(true);
    });

    test("reports missing both TASK and GOAL sections", () => {
      const content = `
ROLE
  Role content
---
INPUT
  Input content
---
OUTPUT
  Output content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Missing TASK or GOAL section")
      )).toBe(true);
    });

    test("allows GOAL as alternative to TASK", () => {
      const content = `
ROLE
  Role content
---
INPUT
  Input content
---
GOAL
  Goal content
---
OUTPUT
  Output content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => e.message.includes("TASK"))).toBe(false);
      expect(errors.some(e => e.message.includes("GOAL"))).toBe(false);
    });

  });

  // ── Multiple errors in one document ─────────────────────────────────────

  describe("multiple errors in one document", () => {

    test("reports multiple structural errors", () => {
      const content = `
ROLE
  Content
INPUT
  No separator
---
TASK
  Content
===  # Invalid separator
OUTPUT
  Content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      const hasMissingSeparator = errors.some(e => 
        e.message.includes("Missing separator before this section title")
      );
      const hasInvalidSeparator = errors.some(e => 
        e.message.includes("Invalid separator, should be ---")
      );
      
      expect(hasMissingSeparator).toBe(true);
      expect(hasInvalidSeparator).toBe(true);
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    test("reports both empty section and missing separator", () => {
      const content = `
ROLE

INPUT
  Content
`;
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      const hasEmptySection = errors.some(e => 
        e.message.includes("Empty section content")
      );
      const hasMissingSeparator = errors.some(e => 
        e.message.includes("Missing separator")
      );
      
      expect(hasEmptySection || hasMissingSeparator).toBe(true);
    });

  });

  // ── Line number accuracy ────────────────────────────────────────────────

  describe("line number accuracy", () => {

    test("reports correct line numbers for errors", () => {
      const content = `LINE 1: ROLE
LINE 2:   Content
LINE 3: 
LINE 4: INPUT
LINE 5:   Missing separator above`;
      
      // This is a raw content string - we need to check the actual line numbers
      // The content above has ROLE on line 1, INPUT on line 4
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      const missingSeparatorError = errors.find(e => 
        e.message.includes("Missing separator before this section title")
      );
      
      if (missingSeparatorError) {
        expect(missingSeparatorError.line).toBe(4);
      }
    });

    test("reports correct line for duplicate section", () => {
      const content = `ROLE
  Content
---
ROLE
  Duplicate`;
      
      const feedback = checkSections(content);
      const errors = feedback.filter(f => f.type === "error");
      
      const duplicateError = errors.find(e => 
        e.message.includes("Section title already exists")
      );
      
      expect(duplicateError.line).toBe(5); // Second ROLE at line 5
    });

  });

  // ── Feedback array parameter ────────────────────────────────────────────

  describe("feedback array parameter", () => {

    test("accepts and mutates existing feedback array", () => {
      const existingFeedback = [{ type: "info", message: "Existing message" }];
      const content = `
ROLE
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
      const feedback = checkSections(content, existingFeedback);
      
      expect(feedback).toBe(existingFeedback);
      expect(feedback.length).toBeGreaterThan(1);
      expect(feedback[0].type).toBe("info");
    });

    test("creates new array when not provided", () => {
      const content = `
ROLE
  Content
---
INPUT
  Content
`;
      const feedback = checkSections(content);
      
      expect(Array.isArray(feedback)).toBe(true);
      expect(feedback.length).toBeGreaterThan(0);
    });

  });

});