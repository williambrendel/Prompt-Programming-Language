"use strict";

const { 
  checkSectionContent, 
  sectionAnalysis, 
  validateFlowSyntax, 
  validateSingleFlow 
} = require("../../../src/utilities/validate/checkSectionContent");

describe("checkSectionContent", () => {

  // ── Valid documents ─────────────────────────────────────────────────────

  describe("valid documents", () => {
    test("validates complete document with REASONING and FLOW sections", () => {
      const content = `
TASK
  Main task

---

ROLE
  Assistant

---

INPUT
  FORMAT: text

---

FLOW
  $input |> validate |> process |> $output

---

REASONING
  IF condition IS TRUE THEN action=do_it
  ELSE action=skip

---

OUTPUT
  FORMAT: json
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors.length).toBe(0);
    });

    test("validates document with uppercase logic operators", () => {
      const content = `
REASONING
  IF score GREATER THAN 90 THEN grade="A"
  ELSE IF score GREATER THAN 80 THEN grade="B"
  ELSE grade="F"
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors.length).toBe(0);
    });

    test("validates document with only FLOW section (no REASONING)", () => {
      const content = `
FLOW
  $input |> validate |> process |> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors.length).toBe(0);
    });

    test("validates document with compounding flows (no names needed)", () => {
      const content = `
FLOW
  $word1 |> $word2
  $word2 |> $word3
  
  $word3 |> $word4
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors.length).toBe(0);
    });

    test("validates document with multiple named flows", () => {
      const content = `
FLOW
  primary: $input |> validate |> $validated
  secondary: $input |> cache |> $cached
  fallback: $error |> retry |> $recovered
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors.length).toBe(0);
    });

    test("validates flow with variable steps", () => {
      const content = `
FLOW
  $data |> $validator |> $transformer |> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors.length).toBe(0);
    });

    test("validates flow with hyphens and underscores in steps", () => {
      const content = `
FLOW
  $input |> validate-input |> sanitize_output |> transform_data |> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors.length).toBe(0);
    });

    test("validates multi-line flow", () => {
      const content = `
FLOW
  $input |> validate
  |> sanitize
  |> transform
  |> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      expect(errors.length).toBe(0);
    });

  });

  // ── Logic operator validation (REASONING section) ───────────────────────

  describe("logic operator validation", () => {

    test("reports error for lowercase logic operators in REASONING section", () => {
      const content = `
REASONING
  if temperature > 100 then alert="overheating"
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Comparison and logic operators have to be capitalized")
      )).toBe(true);
    });

    test("reports error for lowercase IF in REASONING section", () => {
      const content = `
REASONING
  if x > y THEN z=x
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Comparison and logic operators have to be capitalized")
      )).toBe(true);
    });

    test("reports error for lowercase THEN in REASONING section", () => {
      const content = `
REASONING
  IF x > y then z=x
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Comparison and logic operators have to be capitalized")
      )).toBe(true);
    });

    test("allows operators in STEPS section (treated as REASONING)", () => {
      const content = `
STEPS
  IF score > 90 THEN grade="A"
  ELSE grade="F"
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Comparison and logic operators have to be capitalized")
      )).toBe(false);
    });

    test("allows operators in ALGORITHM section (treated as REASONING)", () => {
      const content = `
ALGORITHM
  IF count > 0 THEN process=true
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Comparison and logic operators have to be capitalized")
      )).toBe(false);
    });

  });

  // ── Flow operator scope validation ──────────────────────────────────────

  describe("flow operator scope validation", () => {

    test("reports error when |> appears outside FLOW section", () => {
      const content = `
TASK
  $data |> process
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Flow operators like |> must only be used under a FLOW section")
      )).toBe(true);
    });

    test("reports error when |> appears in REASONING section", () => {
      const content = `
REASONING
  $data |> process
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Flow operators like |> must only be used under a FLOW section")
      )).toBe(true);
    });

  });

  // ── Flow syntax validation (within FLOW section) ────────────────────────

  describe("flow syntax validation", () => {

    test("reports error for flow without surrounding values (empty segment)", () => {
      const content = `
FLOW
  $start |> |> $end
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("must be surrounded by")
      )).toBe(true);
    });

    test("reports error for flow not starting with variable", () => {
      const content = `
FLOW
  start |> process |> $end
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Flow must start and end with variables")
      )).toBe(true);
    });

    test("reports error for flow not ending with variable", () => {
      const content = `
FLOW
  $start |> process |> end
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Flow must start and end with variables")
      )).toBe(true);
    });

    test("reports error for flow with invalid step characters", () => {
      const content = `
FLOW
  $input |> process!data |> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid flow step") &&
        e.message.includes("process!data")
      )).toBe(true);
    });

    test("reports error for flow with spaces in step", () => {
      const content = `
FLOW
  $input |> process data |> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid flow step") &&
        e.message.includes("process data")
      )).toBe(true);
    });

    test("reports error for multiple unrelated flows without names", () => {
      const content = `
FLOW
  $start |> process1 |> $mid
  $different |> process2 |> $end
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Multiple flows in FLOW section must be named")
      )).toBe(true);
    });

    test("allows multiple unrelated flows with names", () => {
      const content = `
FLOW
  flow1: $start |> process1 |> $mid
  flow2: $different |> process2 |> $end
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Multiple flows in FLOW section must be named")
      )).toBe(false);
    });

    test("allows compounding chain without names", () => {
      const content = `
FLOW
  $word1 |> $word2
  $word2 |> $word3
  $word3 |> $word4
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Multiple flows in FLOW section must be named")
      )).toBe(false);
    });

    test("allows single flow with name", () => {
      const content = `
FLOW
  named: $start |> process |> $end
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.length).toBe(0);
    });

    test("reports error for duplicate flow names", () => {
      const content = `
FLOW
  process: $input |> validate |> $validated
  process: $different |> transform |> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Duplicate flow name")
      )).toBe(true);
    });

    test("allows unique flow names", () => {
      const content = `
FLOW
  validate: $input |> validate |> $validated
  transform: $validated |> transform |> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Duplicate flow name")
      )).toBe(false);
    });

    test("reports error for empty FLOW section with content but no flows", () => {
      const content = `
FLOW
  # Just a comment
  # No flow operators here
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("contains no valid flow definitions")
      )).toBe(true);
    });

    test("reports error for broken compounding chain (missing variable connection)", () => {
      const content = `
FLOW
  $word1 |> $word2
  $word3 |> $word4
  $word4 |> $word5
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Multiple flows in FLOW section must be named")
      )).toBe(true);
    });

    test("allows compounding chain with named flows in between", () => {
      const content = `
FLOW
  $word1 |> $word2
  special: $word2 |> transform |> $word3
  $word3 |> $word4
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Multiple flows in FLOW section must be named")
      )).toBe(false);
    });

    test("reports error when unnamed flow doesn't connect to previous output", () => {
      const content = `
FLOW
  named: $start |> process1 |> $mid
  $different |> process2 |> $end
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Multiple flows in FLOW section must be named")
      )).toBe(true);
    });

  });

  // ── Non-standard flow operator detection ────────────────────────────────

  describe("non-standard flow operator detection", () => {

    test("reports error for -> operator", () => {
      const content = `
FLOW
  $input -> process -> $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid flow operator")
      )).toBe(true);
    });

    test("reports error for => operator", () => {
      const content = `
FLOW
  $input => process => $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid flow operator")
      )).toBe(true);
    });

    test("reports error for > operator", () => {
      const content = `
FLOW
  $input > process > $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid flow operator")
      )).toBe(true);
    });

    test("reports error for Unicode arrow →", () => {
      const content = `
FLOW
  $input → process → $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid flow operator")
      )).toBe(true);
    });

    test("reports error for Unicode triangle ▶", () => {
      const content = `
FLOW
  $input ▶ process ▶ $output
`;
      const feedback = checkSectionContent(content);
      const errors = feedback.filter(f => f.type === "error");
      
      expect(errors.some(e => 
        e.message.includes("Invalid flow operator")
      )).toBe(true);
    });

  });

  // ── sectionAnalysis function tests ──────────────────────────────────────

  describe("sectionAnalysis (sub-function)", () => {

    test("detects lowercase logic operators in REASONING section", () => {
      const contentLines = [
        { txt: "  if x > y then z=x", line: 2 }
      ];
      const feedback = [];
      sectionAnalysis({txt: "REASONING", line: 1}, contentLines, feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Comparison and logic operators have to be capitalized")
      )).toBe(true);
    });

    test("allows logic operators in STEPS section", () => {
      const contentLines = [
        { txt: "  IF x > y THEN z=x", line: 2 }
      ];
      const feedback = [];
      sectionAnalysis({txt: "STEPS", line: 1}, contentLines, feedback);
      
      expect(feedback.length).toBe(0);
    });

    test("reports error when |> found in non-FLOW section", () => {
      const contentLines = [
        { txt: "  $data |> process", line: 2 }
      ];
      const feedback = [];
      sectionAnalysis("TASK", contentLines, feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Flow operators like |> must only be used under a FLOW section")
      )).toBe(true);
    });

  });

  // ── validateFlowSyntax function tests ───────────────────────────────────

  describe("validateFlowSyntax (sub-function)", () => {

    test("detects empty segment between |> operators", () => {
      const content = "$start |> |> $end";
      const contentLines = [{ txt: "$start |> |> $end", line: 2 }];
      const feedback = [];
      
      validateFlowSyntax(content, contentLines, 2, feedback);
      
      expect(feedback.some(f => 
        f.message.includes("must be surrounded by")
      )).toBe(true);
    });

    test("detects multiple unrelated flows without names", () => {
      const content = "$start |> step1 |> $mid\n$different |> step2 |> $end";
      const contentLines = [
        { txt: "$start |> step1 |> $mid", line: 2 },
        { txt: "$different |> step2 |> $end", line: 3 }
      ];
      const feedback = [];
      
      validateFlowSyntax(content, contentLines, [2,3], feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Multiple flows in FLOW section must be named")
      )).toBe(true);
    });

    test("allows compounding chain without names", () => {
      const content = "$word1 |> $word2\n$word2 |> $word3";
      const contentLines = [
        { txt: "$word1 |> $word2", line: 2 },
        { txt: "$word2 |> $word3", line: 3 }
      ];
      const feedback = [];
      
      validateFlowSyntax(content, contentLines, [2,3], feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Multiple flows in FLOW section must be named")
      )).toBe(false);
    });

    test("detects non-standard flow operator", () => {
      const content = "$input -> process -> $output";
      const contentLines = [{ txt: "$input -> process -> $output", line: 2 }];
      const feedback = [];
      
      validateFlowSyntax(content, contentLines, 2, feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Invalid flow operator")
      )).toBe(true);
    });

    test("detects duplicate flow names", () => {
      const content = "process: $start |> step1 |> $mid\nprocess: $different |> step2 |> $end";
      const contentLines = [
        { txt: "process: $start |> step1 |> $mid", line: 2 },
        { txt: "process: $different |> step2 |> $end", line: 3 }
      ];
      const feedback = [];
      
      validateFlowSyntax(content, contentLines, [2,3], feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Duplicate flow name")
      )).toBe(true);
    });

    test("detects empty FLOW section with content but no flows", () => {
      const content = "# Just comments\n# No flow operators";
      const contentLines = [
        { txt: "# Just comments", line: 2 },
        { txt: "# No flow operators", line: 3 }
      ];
      const feedback = [];
      
      validateFlowSyntax(content, contentLines, [2,3], feedback);
      
      expect(feedback.some(f => 
        f.message.includes("contains no valid flow definitions")
      )).toBe(true);
    });

  });

  // ── validateSingleFlow function tests ───────────────────────────────────

  describe("validateSingleFlow (sub-function)", () => {

    test("validates correct flow with word steps", () => {
      const flow = {
        parts: ["$input |> validate |> sanitize |> $output"],
        lines: [2]
      };
      const feedback = [];
      
      validateSingleFlow(flow, feedback);
      
      expect(feedback.length).toBe(0);
    });

    test("validates correct flow with variable steps", () => {
      const flow = {
        parts: ["$input |> $validator |> $sanitizer |> $output"],
        lines: [2]
      };
      const feedback = [];
      
      validateSingleFlow(flow, feedback);
      
      expect(feedback.length).toBe(0);
    });

    test("validates correct flow with hyphens and underscores", () => {
      const flow = {
        parts: ["$input |> validate-input |> sanitize_output |> $output"],
        lines: [2]
      };
      const feedback = [];
      
      validateSingleFlow(flow, feedback);
      
      expect(feedback.length).toBe(0);
    });

    test("validates named flow", () => {
      const flow = {
        parts: ["auth: $creds |> verify |> $user"],
        lines: [2]
      };
      const feedback = [];
      
      validateSingleFlow(flow, feedback);
      
      expect(feedback.length).toBe(0);
    });

    test("validates multi-line flow", () => {
      const flow = {
        parts: ["$input |> validate", "|> sanitize |> $output"],
        lines: [2, 3]
      };
      const feedback = [];
      
      validateSingleFlow(flow, feedback);
      
      expect(feedback.length).toBe(0);
    });

    test("reports error when flow doesn't start with variable", () => {
      const flow = {
        parts: ["input |> process |> $output"],
        lines: [2]
      };
      const feedback = [];
      
      validateSingleFlow(flow, feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Flow must start and end with variables")
      )).toBe(true);
    });

    test("reports error when flow doesn't end with variable", () => {
      const flow = {
        parts: ["$input |> process |> output"],
        lines: [2]
      };
      const feedback = [];
      
      validateSingleFlow(flow, feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Flow must start and end with variables")
      )).toBe(true);
    });

    test("reports error for invalid step characters", () => {
      const flow = {
        parts: ["$input |> process!data |> $output"],
        lines: [2]
      };
      const feedback = [];
      
      validateSingleFlow(flow, feedback);
      
      expect(feedback.some(f => 
        f.message.includes("Invalid flow step") &&
        f.message.includes("process!data")
      )).toBe(true);
    });

  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {

    test("handles empty content", () => {
      const feedback = checkSectionContent("");
      expect(Array.isArray(feedback)).toBe(true);
    });

    test("handles content with only comments", () => {
      const content = `
# Comment line 1
# Comment line 2
`;
      const feedback = checkSectionContent(content);
      expect(Array.isArray(feedback)).toBe(true);
    });

    test("handles section with no content", () => {
      const content = `
TASK

---

ROLE
  Content
`;
      const feedback = checkSectionContent(content);
      expect(Array.isArray(feedback)).toBe(true);
    });

  });

  // ── Feedback array parameter ────────────────────────────────────────────

  describe("feedback array parameter", () => {

    test("accepts and mutates existing feedback array", () => {
      const existingFeedback = [{ type: "info", message: "Pre-check", line: 0 }];
      const content = `
FLOW
  $start |> |> $end
`;
      const feedback = checkSectionContent(content, existingFeedback);
      
      expect(feedback).toBe(existingFeedback);
      expect(feedback.length).toBeGreaterThan(1);
      expect(feedback[0].type).toBe("info");
    });

    test("creates new array when not provided", () => {
      const content = `
FLOW
  $input |> process |> $output
`;
      const feedback = checkSectionContent(content);
      
      expect(Array.isArray(feedback)).toBe(true);
    });

  });

});