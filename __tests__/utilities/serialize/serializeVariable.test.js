"use strict";

const serializeVariable = require("../../../src/utilities/serialize/serializeVariable");

// ── invalid input ─────────────────────────────────────────────────────────────

describe("serializeVariable — invalid input", () => {

  test("throws for null", () => {
    expect(() => serializeVariable(null)).toThrow();
  });

  test("throws for undefined", () => {
    expect(() => serializeVariable(undefined)).toThrow();
  });

  test("throws for number", () => {
    expect(() => serializeVariable(42)).toThrow();
  });

  test("throws for boolean", () => {
    expect(() => serializeVariable(true)).toThrow();
  });

  test("throws for array", () => {
    expect(() => serializeVariable(["name"])).toThrow();
  });

  test("throws for object missing name", () => {
    expect(() => serializeVariable({ description: "no name here" })).toThrow();
  });

  test("throws for object with empty name", () => {
    expect(() => serializeVariable({ name: "" })).toThrow();
  });

  test("error message includes invalid value for primitives", () => {
    expect(() => serializeVariable(42)).toThrow("42");
  });

  test("error message includes serialized object for missing name", () => {
    expect(() => serializeVariable({ description: "oops" })).toThrow("missing its name");
  });

});

// ── string input ──────────────────────────────────────────────────────────────

describe("serializeVariable — string input", () => {

  test("normalizes plain string to $snake_case variable", () => {
    expect(serializeVariable("userCount")).toBe("$user_count");
  });

  test("preserves existing $ prefix", () => {
    expect(serializeVariable("$question")).toBe("$question");
  });

  test("collapses multiple $ prefixes", () => {
    expect(serializeVariable("$$$question")).toBe("$question");
  });

  test("converts camelCase to snake_case", () => {
    expect(serializeVariable("verifiedAnswer")).toBe("$verified_answer");
  });

  test("converts PascalCase to snake_case", () => {
    expect(serializeVariable("VerifiedAnswer")).toBe("$verified_answer");
  });

  test("converts spaces to underscores", () => {
    expect(serializeVariable("user name")).toBe("$user_name");
  });

  test("converts hyphens to underscores", () => {
    expect(serializeVariable("user-name")).toBe("$user_name");
  });

  test("handles acronym", () => {
    expect(serializeVariable("APIResponse")).toBe("$api_response");
  });

  test("trims whitespace before normalizing", () => {
    expect(serializeVariable("  question  ")).toBe("$question");
  });

});

// ── object — name only ────────────────────────────────────────────────────────

describe("serializeVariable — object name only", () => {

  test("returns normalized variable name", () => {
    expect(serializeVariable({ name: "question" })).toBe("$question");
  });

  test("normalizes camelCase name", () => {
    expect(serializeVariable({ name: "userFirstName" })).toBe("$user_first_name");
  });

  test("preserves existing $ prefix on name", () => {
    expect(serializeVariable({ name: "$question" })).toBe("$question");
  });

});

// ── object — name + single-line description ───────────────────────────────────

describe("serializeVariable — name + single-line description", () => {

  test("produces inline name: description format", () => {
    expect(serializeVariable({ name: "question", description: "user question" })).toBe(
      "$question: user question"
    );
  });

  test("trims description whitespace", () => {
    expect(serializeVariable({ name: "question", description: "  user question  " })).toBe(
      "$question: user question"
    );
  });

  test("normalizes name alongside description", () => {
    expect(serializeVariable({ name: "userQuestion", description: "user question" })).toBe(
      "$user_question: user question"
    );
  });

});

// ── object — name + multi-line description ────────────────────────────────────

describe("serializeVariable — name + multi-line description", () => {

  test("produces indented block for multi-line description", () => {
    expect(serializeVariable({ name: "question", description: "line 1\nline 2" })).toBe(
      "$question:\n  line 1\n  line 2"
    );
  });

  test("uses custom indent for description block", () => {
    expect(serializeVariable({ name: "question", description: "line 1\nline 2" }, "    ")).toBe(
      "$question:\n    line 1\n    line 2"
    );
  });

  test("collapses multiple blank lines in description", () => {
    expect(serializeVariable({ name: "question", description: "line 1\n\n\nline 2" })).toBe(
      "$question:\n  line 1\n\n  line 2"
    );
  });

});

// ── object — with format ──────────────────────────────────────────────────────

describe("serializeVariable — with format", () => {

  test("includes format in meta block", () => {
    const result = serializeVariable({
      name: "documents",
      description: "knowledge base documents",
      format: "json"
    });
    expect(result).toContain("  format: json");
  });

  test("format appears after description in meta block", () => {
    const result = serializeVariable({
      name: "documents",
      description: "knowledge base documents",
      format: "json"
    });
    const descIdx = result.indexOf("description:");
    const fmtIdx = result.indexOf("format:");
    expect(descIdx).toBeLessThan(fmtIdx);
  });

  test("produces correct meta block structure with description and format", () => {
    const result = serializeVariable({
      name: "documents",
      description: "knowledge base docs",
      format: "json"
    });
    expect(result).toMatch(/^\$documents:\n/);
    expect(result).toContain("  description: knowledge base docs");
    expect(result).toContain("  format: json");
  });

});

// ── object — with provenance ──────────────────────────────────────────────────

describe("serializeVariable — with provenance", () => {

  test("includes provenance string in meta block", () => {
    const result = serializeVariable({
      name: "question",
      description: "user question",
      provenance: "extracted"
    });
    expect(result).toContain("provenance: extracted");
  });

  test("provenance appears in indented meta block", () => {
    const result = serializeVariable({
      name: "question",
      description: "user question",
      provenance: "extracted"
    });
    expect(result).toContain("  provenance: extracted");
  });

  test("handles provenance without description", () => {
    const result = serializeVariable({
      name: "question",
      provenance: "inferred"
    });
    expect(result).toContain("provenance: inferred");
  });

});

// ── object — with schema ──────────────────────────────────────────────────────

describe("serializeVariable — with schema", () => {

  test("includes schema block in meta", () => {
    const result = serializeVariable({
      name: "documents",
      description: "knowledge base docs",
      format: "json",
      schema: { id: "string", content: "string" }
    });
    expect(result).toContain("schema:");
    expect(result).toContain("```json");
    expect(result).toContain('"id": "string"');
  });

  test("schema is double-indented", () => {
    const result = serializeVariable({
      name: "documents",
      description: "docs",
      format: "json",
      schema: { id: "string" }
    });
    expect(result).toContain("    ```json");
  });

  test("schema appears after format in meta block", () => {
    const result = serializeVariable({
      name: "documents",
      description: "docs",
      format: "json",
      schema: { id: "string" }
    });
    const fmtIdx  = result.indexOf("format:");
    const schIdx  = result.indexOf("schema:");
    expect(fmtIdx).toBeLessThan(schIdx);
  });

  test("schema as string uses format as language identifier", () => {
    const result = serializeVariable({
      name: "documents",
      description: "docs",
      format: "yaml",
      schema: "id: string\ncontent: string"
    });
    expect(result).toContain("```yaml");
    expect(result).toContain("id: string");
  });

  test("schema without format produces plain code fence", () => {
    const result = serializeVariable({
      name: "documents",
      description: "docs",
      schema: { id: "string" }
    });
    expect(result).toContain("schema:");
    expect(result).toContain("```");
  });

});

// ── object — full complex ─────────────────────────────────────────────────────

describe("serializeVariable — full complex object", () => {

  test("serializes all fields in correct order", () => {
    const variable = {
      name: "verified_answer",
      description: "final verified answer with citations",
      provenance: "inferred",
      format: "markdown",
      schema: { answer: "string", citations: "array", confidence: "number" }
    };
    const result = serializeVariable(variable);

    expect(result).toMatch(/^\$verified_answer:\n/);

    const descIdx  = result.indexOf("description:");
    const provIdx  = result.indexOf("provenance:");
    const fmtIdx   = result.indexOf("format:");
    const schIdx   = result.indexOf("schema:");

    expect(descIdx).toBeLessThan(provIdx);
    expect(provIdx).toBeLessThan(fmtIdx);
    expect(fmtIdx).toBeLessThan(schIdx);
  });

  test("all fields properly indented", () => {
    const variable = {
      name: "documents",
      description: "knowledge base documents",
      provenance: "extracted",
      format: "json",
      schema: { id: "string", content: "string", source: "string" }
    };
    const result = serializeVariable(variable);

    expect(result).toContain("  description: knowledge base documents");
    expect(result).toContain("  provenance: extracted");
    expect(result).toContain("  format: json");
    expect(result).toContain("  schema:");
    expect(result).toContain("    ```json");
  });

});

// ── PPL2 scenarios ────────────────────────────────────────────────────────────

describe("serializeVariable — PPL2 scenarios", () => {

  test("serializes $question input variable", () => {
    const result = serializeVariable({
      name: "question",
      description: "user question to answer",
      format: "text",
      provenance: "extracted"
    });
    expect(result).toMatch(/^\$question:\n/);
    expect(result).toContain("  description: user question to answer");
    expect(result).toContain("  provenance: extracted");
    expect(result).toContain("  format: text");
  });

  test("serializes $documents input variable with schema", () => {
    const result = serializeVariable({
      name: "documents",
      description: "knowledge base documents",
      format: "json",
      provenance: "extracted",
      schema: { id: "string", content: "string", source: "string" }
    });
    expect(result).toMatch(/^\$documents:\n/);
    expect(result).toContain('"id": "string"');
    expect(result).toContain('"source": "string"');
  });

  test("serializes $verified_answer output variable", () => {
    const result = serializeVariable({
      name: "verifiedAnswer",
      description: "final verified answer with citations",
      format: "markdown",
      schema: { answer: "string", citations: "array", confidence: "number" }
    });
    expect(result).toMatch(/^\$verified_answer:\n/);
    expect(result).toContain("  format: markdown");
    expect(result).toContain('"answer": "string"');
  });

  test("serializes intermediate $embedded variable", () => {
    const result = serializeVariable({
      name: "embedded",
      description: "question embedded into vector space",
      provenance: "inferred"
    });
    expect(result).toBe(
      "$embedded:\n  description: question embedded into vector space\n  provenance: inferred"
    );
  });

  test("serializes simple string variable reference", () => {
    expect(serializeVariable("$relevance_score")).toBe("$relevance_score");
    expect(serializeVariable("relevanceScore")).toBe("$relevance_score");
  });

});

// ── custom indent ─────────────────────────────────────────────────────────────

describe("serializeVariable — custom indent", () => {

  test("uses four-space indent", () => {
    const result = serializeVariable({
      name: "question",
      description: "user question",
      format: "text"
    }, "    ");
    expect(result).toContain("    description: user question");
    expect(result).toContain("    format: text");
  });

  test("uses tab indent", () => {
    const result = serializeVariable({
      name: "question",
      description: "user question",
      format: "text"
    }, "\t");
    expect(result).toContain("\tdescription: user question");
    expect(result).toContain("\tformat: text");
  });

});

// ── meta fields without description ──────────────────────────────────────────

describe("serializeVariable — meta fields without description", () => {

  test("format only — no blank line between name and format", () => {
    const result = serializeVariable({ name: "question", format: "text" });
    expect(result).toBe("$question:\n  format: text");
  });

  test("provenance only — no blank line between name and provenance", () => {
    const result = serializeVariable({ name: "question", provenance: "extracted" });
    expect(result).toBe("$question:\n  provenance: extracted");
  });

  test("format and provenance — no blank line at top", () => {
    const result = serializeVariable({ name: "question", provenance: "extracted", format: "text" });
    expect(result).not.toMatch(/:\n\n/);
    expect(result).toContain("  provenance: extracted");
    expect(result).toContain("  format: text");
  });

  test("schema only — no blank line between name and schema", () => {
    const result = serializeVariable({ name: "documents", format: "json", schema: { id: "string" } });
    expect(result).not.toMatch(/:\n\n/);
    expect(result).toContain("  schema:");
    expect(result).toContain("    ```json");
  });

  test("all meta fields no description — no blank line at top", () => {
    const result = serializeVariable({
      name: "documents",
      provenance: "extracted",
      format: "json",
      schema: { id: "string" }
    });
    expect(result).toMatch(/^\$documents:\n  provenance/);
  });

});

// ── module contract ───────────────────────────────────────────────────────────

describe("module contract", () => {

  test("exports a function", () => {
    expect(typeof serializeVariable).toBe("function");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(serializeVariable)).toBe(true);
  });

  test("has self-referential serializeVariable property", () => {
    expect(serializeVariable.serializeVariable).toBe(serializeVariable);
  });

  test("self-referential property is non-writable", () => {
    const desc = Object.getOwnPropertyDescriptor(serializeVariable, "serializeVariable");
    expect(desc.writable).toBe(false);
  });

  test("self-referential property is non-configurable", () => {
    const desc = Object.getOwnPropertyDescriptor(serializeVariable, "serializeVariable");
    expect(desc.configurable).toBe(false);
  });

});
