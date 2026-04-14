"use strict";

const serializeSchema = require("../../../src/utilities/serialize/serializeSchema");

const { isValidShema } = serializeSchema;

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Wraps content in a markdown code fence with optional language identifier.
 * @param {string} content
 * @param {string} [lang=""]
 */
const fence = (content, lang = "") => `\`\`\`${lang}\n${content}\n\`\`\``;

// ── isValidShema ──────────────────────────────────────────────────────────────

describe("isValidShema", () => {

  describe("invalid input", () => {

    test("returns falsy for null", () => {
      expect(isValidShema(null)).toBeFalsy();
    });

    test("returns falsy for undefined", () => {
      expect(isValidShema(undefined)).toBeFalsy();
    });

    test("returns falsy for 0", () => {
      expect(isValidShema(0)).toBeFalsy();
    });

    test("returns falsy for false", () => {
      expect(isValidShema(false)).toBeFalsy();
    });

    test("returns falsy for empty string", () => {
      expect(isValidShema("")).toBeFalsy();
    });

    test("returns falsy for empty object", () => {
      expect(isValidShema({})).toBeFalsy();
    });

    test("returns falsy for empty array", () => {
      expect(isValidShema([])).toBeFalsy();
    });

  });

  describe("valid input", () => {

    test("returns truthy for non-empty string", () => {
      expect(isValidShema("name: string")).toBeTruthy();
    });

    test("returns truthy for single-space string", () => {
      expect(isValidShema(" ")).toBeTruthy();
    });

    test("returns truthy for non-empty object", () => {
      expect(isValidShema({ name: "string" })).toBeTruthy();
    });

    test("returns truthy for object with multiple keys", () => {
      expect(isValidShema({ name: "string", age: "number" })).toBeTruthy();
    });

    test("returns truthy for nested object", () => {
      expect(isValidShema({ user: { name: "string" } })).toBeTruthy();
    });

    test("returns truthy for non-empty array", () => {
      expect(isValidShema(["string"])).toBeTruthy();
    });

  });

});

// ── serializeSchema — invalid input ──────────────────────────────────────────

describe("serializeSchema — invalid input", () => {

  test("returns empty string for null", () => {
    expect(serializeSchema(null)).toBe("");
  });

  test("returns empty string for undefined", () => {
    expect(serializeSchema(undefined)).toBe("");
  });

  test("returns empty string for 0", () => {
    expect(serializeSchema(0)).toBe("");
  });

  test("returns empty string for false", () => {
    expect(serializeSchema(false)).toBe("");
  });

  test("returns empty string for empty object", () => {
    expect(serializeSchema({})).toBe("");
  });

  test("returns empty string for empty string", () => {
    expect(serializeSchema("")).toBe("");
  });

  test("returns empty string for empty array", () => {
    expect(serializeSchema([])).toBe("");
  });

});

// ── serializeSchema — string schema ──────────────────────────────────────────

describe("serializeSchema — string schema", () => {

  test("wraps plain string in code fence", () => {
    expect(serializeSchema("name: string")).toBe(fence("name: string"));
  });

  test("wraps multiline string in code fence", () => {
    const yaml = "name: string\nversion: number";
    expect(serializeSchema(yaml)).toBe(fence(yaml));
  });

  test("applies format identifier to code fence", () => {
    expect(serializeSchema("name: string", "yaml")).toBe(fence("name: string", "yaml"));
  });

  test("lowercases format identifier", () => {
    expect(serializeSchema("name: string", "YAML")).toBe(fence("name: string", "yaml"));
    expect(serializeSchema("name: string", "JSON")).toBe(fence("name: string", "json"));
  });

  test("handles empty format string", () => {
    expect(serializeSchema("name: string", "")).toBe(fence("name: string", ""));
  });

  test("handles undefined format", () => {
    expect(serializeSchema("name: string", undefined)).toBe(fence("name: string", ""));
  });

  test("handles null format", () => {
    expect(serializeSchema("name: string", null)).toBe(fence("name: string", ""));
  });

});

// ── serializeSchema — object schema ──────────────────────────────────────────

describe("serializeSchema — object schema", () => {

  test("serializes simple object as JSON code fence", () => {
    const schema = { name: "string" };
    expect(serializeSchema(schema, "json")).toBe(fence(JSON.stringify(schema, null, "  "), "json"));
  });

  test("serializes nested object correctly", () => {
    const schema = { user: { name: "string", age: "number" } };
    expect(serializeSchema(schema, "json")).toBe(fence(JSON.stringify(schema, null, "  "), "json"));
  });

  test("serializes object with array values", () => {
    const schema = { tags: ["string"], count: "number" };
    expect(serializeSchema(schema, "json")).toBe(fence(JSON.stringify(schema, null, "  "), "json"));
  });

  test("uses default two-space indent", () => {
    const schema = { name: "string" };
    const result = serializeSchema(schema, "json");
    expect(result).toContain('  "name"');
  });

  test("uses custom four-space indent", () => {
    const schema = { name: "string" };
    expect(serializeSchema(schema, "json", "    ")).toBe(fence(JSON.stringify(schema, null, "    "), "json"));
  });

  test("uses tab indent", () => {
    const schema = { name: "string" };
    expect(serializeSchema(schema, "json", "\t")).toBe(fence(JSON.stringify(schema, null, "\t"), "json"));
  });

  test("non-json format with object still serializes as JSON", () => {
    const schema = { name: "string" };
    expect(serializeSchema(schema, "yaml")).toBe(fence(JSON.stringify(schema, null, "  "), "yaml"));
  });

  test("no format with object produces plain fence", () => {
    const schema = { name: "string" };
    expect(serializeSchema(schema, "")).toBe(fence(JSON.stringify(schema, null, "  "), ""));
  });

});

// ── serializeSchema — out parameter ──────────────────────────────────────────

describe("serializeSchema — out parameter", () => {

  test("prepends out string to result", () => {
    const result = serializeSchema({ name: "string" }, "json", "  ", "schema:\n");
    expect(result.startsWith("schema:\n")).toBe(true);
  });

  test("out defaults to empty string", () => {
    const schema = { name: "string" };
    const withOut    = serializeSchema(schema, "json", "  ", "");
    const withoutOut = serializeSchema(schema, "json", "  ");
    expect(withOut).toBe(withoutOut);
  });

  test("out is prepended before opening fence", () => {
    const result = serializeSchema({ name: "string" }, "json", "  ", "prefix\n");
    expect(result).toMatch(/^prefix\n```json/);
  });

});

// ── serializeSchema — code fence structure ────────────────────────────────────

describe("serializeSchema — code fence structure", () => {

  test("opening fence is on its own line", () => {
    expect(serializeSchema({ name: "string" }, "json")).toMatch(/^```json\n/);
  });

  test("closing fence is on its own line", () => {
    expect(serializeSchema({ name: "string" }, "json")).toMatch(/\n```$/);
  });

  test("opening fence with no format has no trailing chars before newline", () => {
    expect(serializeSchema("name: string")).toMatch(/^```\n/);
  });

  test("content sits between opening and closing fences", () => {
    expect(serializeSchema("hello", "")).toBe("```\nhello\n```");
  });

});

// ── serializeSchema — PPL2 scenarios ─────────────────────────────────────────

describe("serializeSchema — PPL2 scenarios", () => {

  test("serializes INPUT variable schema", () => {
    const schema = { id: "string", content: "string", source: "string" };
    const result = serializeSchema(schema, "json");
    expect(result).toContain("```json");
    expect(result).toContain('"id": "string"');
    expect(result).toContain('"content": "string"');
    expect(result).toContain('"source": "string"');
    expect(result).toMatch(/\n```$/);
  });

  test("serializes OUTPUT schema with citations array", () => {
    const schema = { answer: "string", citations: "array", confidence: "number" };
    const result = serializeSchema(schema, "json");
    expect(result).toContain('"citations": "array"');
    expect(result).toContain('"confidence": "number"');
  });

  test("serializes YAML string schema", () => {
    const schema = "name: string\nformat: text\nprovenance: extracted | inferred | missing";
    expect(serializeSchema(schema, "yaml")).toBe(fence(schema, "yaml"));
  });

  test("serializes validation schema with nested structure", () => {
    const schema = {
      answer: "string",
      citations: ["string"],
      confidence: "number",
      metadata: { source: "string" }
    };
    const result = serializeSchema(schema, "json");
    expect(result).toContain('"citations"');
    expect(result).toContain('"metadata"');
  });

});

// ── module contract ───────────────────────────────────────────────────────────

describe("module contract", () => {

  test("exports a function", () => {
    expect(typeof serializeSchema).toBe("function");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(serializeSchema)).toBe(true);
  });

  test("has self-referential serializeSchema property", () => {
    expect(serializeSchema.serializeSchema).toBe(serializeSchema);
  });

  test("self-referential property is non-writable", () => {
    const desc = Object.getOwnPropertyDescriptor(serializeSchema, "serializeSchema");
    expect(desc.writable).toBe(false);
  });

  test("self-referential property is non-configurable", () => {
    const desc = Object.getOwnPropertyDescriptor(serializeSchema, "serializeSchema");
    expect(desc.configurable).toBe(false);
  });

  test("exposes isValidShema as a property", () => {
    expect(typeof serializeSchema.isValidShema).toBe("function");
  });

  test("isValidShema property is the actual isValidShema function", () => {
    expect(serializeSchema.isValidShema("test")).toBeTruthy();
    expect(serializeSchema.isValidShema("")).toBeFalsy();
    expect(serializeSchema.isValidShema(null)).toBeFalsy();
    expect(serializeSchema.isValidShema({ key: "value" })).toBeTruthy();
  });

});
