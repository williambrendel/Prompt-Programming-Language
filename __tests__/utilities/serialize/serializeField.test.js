"use strict";

const serializeField = require("../../../src/utilities/serialize/serializeField");

const {
  normalizeNewlines,
  serializeText,
  serializeArray,
  createObjectSerializer,
  serializeObject,
} = serializeField;

// ── normalizeNewlines ─────────────────────────────────────────────────────────

describe("normalizeNewlines", () => {

  describe("trimming", () => {

    test("trims leading whitespace", () => {
      expect(normalizeNewlines("  hello")).toBe("hello");
    });

    test("trims trailing whitespace", () => {
      expect(normalizeNewlines("hello  ")).toBe("hello");
    });

    test("trims both ends", () => {
      expect(normalizeNewlines("  hello  ")).toBe("hello");
    });

    test("trims leading and trailing newlines", () => {
      expect(normalizeNewlines("\nhello\n")).toBe("hello");
    });

  });

  describe("consecutive newline collapsing", () => {

    test("preserves single blank line", () => {
      expect(normalizeNewlines("a\n\nb")).toBe("a\n\nb");
    });

    test("collapses three consecutive newlines into one blank line", () => {
      expect(normalizeNewlines("a\n\n\nb")).toBe("a\n\nb");
    });

    test("collapses four consecutive newlines into one blank line", () => {
      expect(normalizeNewlines("a\n\n\n\nb")).toBe("a\n\nb");
    });

    test("collapses carriage return sequences", () => {
      expect(normalizeNewlines("a\r\rb")).toBe("a\n\nb");
    });

    test("collapses mixed CR and LF sequences", () => {
      expect(normalizeNewlines("a\r\n\r\nb")).toBe("a\n\nb");
    });

  });

  describe("trailing whitespace stripping", () => {

    test("strips trailing spaces before newline", () => {
      expect(normalizeNewlines("hello   \nworld")).toBe("hello\nworld");
    });

    test("strips trailing tabs before newline", () => {
      expect(normalizeNewlines("hello\t\t\nworld")).toBe("hello\nworld");
    });

    test("strips mixed trailing spaces and tabs before newline", () => {
      expect(normalizeNewlines("hello \t \nworld")).toBe("hello\nworld");
    });

    test("strips trailing whitespace before end of string", () => {
      expect(normalizeNewlines("hello   ")).toBe("hello");
    });

    test("whitespace-only line becomes empty line", () => {
      expect(normalizeNewlines("Line 1\n   \nLine 2")).toBe("Line 1\n\nLine 2");
    });

    test("tab-only line becomes empty line", () => {
      expect(normalizeNewlines("Line 1\n\t\t\nLine 2")).toBe("Line 1\n\nLine 2");
    });

  });

  describe("non-string coercion", () => {

    test("coerces number to string", () => {
      expect(normalizeNewlines(42)).toBe("42");
    });

    test("coerces boolean to string", () => {
      expect(normalizeNewlines(true)).toBe("true");
    });

    test("coerces null to string", () => {
      expect(normalizeNewlines(null)).toBe("null");
    });

    test("coerces undefined to string", () => {
      expect(normalizeNewlines(undefined)).toBe("undefined");
    });

    test("coerces object to string", () => {
      expect(normalizeNewlines({ toString: () => "hello" })).toBe("hello");
    });

  });

  describe("edge cases", () => {

    test("returns empty string for empty string", () => {
      expect(normalizeNewlines("")).toBe("");
    });

    test("returns empty string for whitespace-only string", () => {
      expect(normalizeNewlines("   ")).toBe("");
    });

    test("preserves internal indentation", () => {
      expect(normalizeNewlines("  hello\n  world")).toBe("hello\n  world");
    });

    test("preserves single newline", () => {
      expect(normalizeNewlines("a\nb")).toBe("a\nb");
    });

    test("handles string with no newlines", () => {
      expect(normalizeNewlines("hello world")).toBe("hello world");
    });

  });

  describe("combined behavior", () => {

    test("multiple whitespace-only lines collapsed to one blank line", () => {
      expect(normalizeNewlines("a\n   \n   \nb")).toBe("a\n\n\nb");
    });

  });

});

// ── serializeField — null / undefined ────────────────────────────────────────

describe("serializeField — null / undefined", () => {

  test("returns empty string for null", () => {
    expect(serializeField("title", null)).toBe("");
  });

  test("returns empty string for undefined", () => {
    expect(serializeField("title", undefined)).toBe("");
  });

  test("returns empty string for null regardless of name", () => {
    expect(serializeField("", null)).toBe("");
    expect(serializeField("anything", null)).toBe("");
  });

});

// ── serializeField — primitive single line ────────────────────────────────────

describe("serializeField — primitive single line", () => {

  test("serializes string as name: value", () => {
    expect(serializeField("title", "Hello World")).toBe("title: Hello World");
  });

  test("serializes number as name: value", () => {
    expect(serializeField("count", 42)).toBe("count: 42");
  });

  test("serializes boolean true", () => {
    expect(serializeField("active", true)).toBe("active: true");
  });

  test("serializes boolean false", () => {
    expect(serializeField("active", false)).toBe("active: false");
  });

  test("serializes zero", () => {
    expect(serializeField("count", 0)).toBe("count: 0");
  });

  test("trims leading and trailing whitespace from value", () => {
    expect(serializeField("title", "  Hello World  ")).toBe("title: Hello World");
  });

  test("returns empty string for whitespace-only string", () => {
    expect(serializeField("title", "   ")).toBe("");
  });

  test("returns empty string for empty string", () => {
    expect(serializeField("title", "")).toBe("");
  });

});

// ── serializeField — primitive multi-line (createArray=false) ─────────────────

describe("serializeField — primitive multi-line (createArray=false)", () => {

  test("serializes multi-line string as indented block", () => {
    expect(serializeField("note", "Line 1\nLine 2", "  ")).toBe(
      "note:\n  Line 1\n  Line 2"
    );
  });

  test("serializes three-line string as indented block", () => {
    expect(serializeField("note", "a\nb\nc", "  ")).toBe(
      "note:\n  a\n  b\n  c"
    );
  });

  test("uses custom indent", () => {
    expect(serializeField("note", "Line 1\nLine 2", "    ")).toBe(
      "note:\n    Line 1\n    Line 2"
    );
  });

  test("collapses multiple blank lines into one", () => {
    expect(serializeField("note", "Line 1\n\n\nLine 2", "  ")).toBe(
      "note:\n  Line 1\n\n  Line 2"
    );
  });

  test("filters out whitespace-only lines", () => {
    expect(serializeField("note", "Line 1\n   \nLine 2", "  ")).toBe(
      "note:\n  Line 1\n\n  Line 2"
    );
  });

  test("two non-empty lines produce indented block", () => {
    expect(serializeField("note", "Line 1\nLine 2", "  ")).toBe(
      "note:\n  Line 1\n  Line 2"
    );
  });

});

// ── serializeField — primitive multi-line (createArray=true) ──────────────────

describe("serializeField — primitive multi-line (createArray=true)", () => {

  test("serializes multi-line string as indexed array block", () => {
    expect(serializeField("note", "Line 1\nLine 2", "  ", { createArray: true })).toBe(
      "notes[2]:\n  - Line 1\n  - Line 2"
    );
  });

  test("pluralizes name in array header", () => {
    const result = serializeField("item", "a\nb\nc", "  ", { createArray: true });
    expect(result).toMatch(/^items\[3\]:/);
  });

  test("count in header matches number of lines", () => {
    const result = serializeField("tag", "x\ny\nz\nw", "  ", { createArray: true });
    expect(result).toMatch(/^tags\[4\]:/);
  });

  test("each line prefixed with indent and dash", () => {
    const result = serializeField("note", "Line 1\nLine 2", "  ", { createArray: true });
    expect(result).toContain("  - Line 1");
    expect(result).toContain("  - Line 2");
  });

  test("single line with createArray=true produces name: value (no array)", () => {
    expect(serializeField("note", "Line 1", "  ", { createArray: true })).toBe(
      "note: Line 1"
    );
  });

  test("filters whitespace-only lines before counting", () => {
    const result = serializeField("note", "Line 1\n   \nLine 2", "  ", { createArray: true });
    expect(result).toMatch(/^notes\[2\]:/);
  });

});

// ── serializeField — plain object ─────────────────────────────────────────────

describe("serializeField — plain object", () => {

  test("serializes single-key object as block", () => {
    expect(serializeField("meta", { version: 1 }, "  ")).toBe(
      "meta:\n  version: 1"
    );
  });

  test("serializes multi-key object as indented block", () => {
    expect(serializeField("schema", { name: "string", age: "number" }, "  ")).toBe(
      "schema:\n  name: string\n  age: number"
    );
  });

  test("uses indent for object serialization", () => {
    expect(serializeField("schema", { name: "string" }, "    ")).toBe(
      "schema:\n    name: string"
    );
  });

  test("serializes nested object recursively", () => {
    expect(serializeField("user", { name: "string", address: { city: "string" } }, "  ")).toBe(
      "user:\n  name: string\n  address:\n    city: string"
    );
  });

  test("uses custom objSerializer returning scalar inline", () => {
    expect(serializeField("data", { key: "value" }, "  ", {
      objSerializer: o => `${o.key}`
    })).toBe("data: value");
  });

  test("uses custom objSerializer producing multi-line output as block", () => {
    const obj = { a: 1, b: 2 };
    const result = serializeField("data", obj, "  ", {
      objSerializer: o => Object.entries(o).map(([k, v]) => `${k}: ${v}`).join("\n")
    });
    expect(result).toMatch(/^data:\n/);
    expect(result).toContain("  a: 1");
    expect(result).toContain("  b: 2");
  });

  test("returns empty string for empty object", () => {
    expect(serializeField("data", {}, "  ")).toBe("");
  });

});

// ── serializeField — array ────────────────────────────────────────────────────

describe("serializeField — array", () => {

  test("single-item array unwrapped to scalar", () => {
    expect(serializeField("tag", ["js"], "  ")).toBe("tag: js");
  });

  test("multi-item array produces indexed block", () => {
    expect(serializeField("tag", ["js", "node"], "  ")).toBe(
      "tags[2]:\n  - js\n  - node"
    );
  });

  test("pluralizes name in array header", () => {
    const result = serializeField("item", ["a", "b", "c"], "  ");
    expect(result).toMatch(/^items\[3\]:/);
  });

  test("count in header matches array length", () => {
    const result = serializeField("tag", ["a", "b", "c", "d"], "  ");
    expect(result).toMatch(/^tags\[4\]:/);
  });

  test("each item prefixed with indent and dash", () => {
    const result = serializeField("tag", ["js", "node"], "  ");
    expect(result).toContain("  - js");
    expect(result).toContain("  - node");
  });

  test("filters empty items from array", () => {
    const result = serializeField("tag", ["js", "", "node"], "  ");
    expect(result).toMatch(/^tags\[2\]:/);
    expect(result).not.toContain("  - \n");
  });

  test("returns empty string for empty array", () => {
    expect(serializeField("tag", [], "  ")).toBe("");
  });

  test("returns empty string for array of empty strings", () => {
    expect(serializeField("tag", ["", "   ", ""], "  ")).toBe("");
  });

  test("multi-line item in array is indented correctly", () => {
    const result = serializeField("note", ["line 1\nline 2", "item 2"], "  ");
    expect(result).toContain("  - line 1");
    expect(result).toContain("    line 2");
  });

  test("single-item array with multi-line content produces indented block", () => {
    const result = serializeField("note", ["line 1\nline 2"], "  ");
    expect(result).toMatch(/^note:\n/);
    expect(result).toContain("  line 1");
    expect(result).toContain("  line 2");
  });

  test("trims whitespace from each item", () => {
    const result = serializeField("tag", ["  js  ", "  node  "], "  ");
    expect(result).toContain("  - js");
    expect(result).toContain("  - node");
  });

  test("flattens nested arrays", () => {
    const result = serializeField("tag", [["js", "node"], "python"], "  ");
    expect(result).toMatch(/^tags\[3\]:/);
    expect(result).toContain("  - js");
    expect(result).toContain("  - node");
    expect(result).toContain("  - python");
  });

});

// ── serializeField — PPL2 scenarios ──────────────────────────────────────────

describe("serializeField — PPL2 scenarios", () => {

  test("serializes role field", () => {
    expect(serializeField("role", "research assistant")).toBe(
      "role: research assistant"
    );
  });

  test("serializes description field", () => {
    expect(serializeField("description", "answer user question using knowledge base")).toBe(
      "description: answer user question using knowledge base"
    );
  });

  test("serializes inputs array with single variable", () => {
    expect(serializeField("input", ["$question"], "  ")).toBe(
      "input: $question"
    );
  });

  test("serializes inputs array with multiple variables", () => {
    const result = serializeField("input", ["$question", "$documents"], "  ");
    expect(result).toMatch(/^inputs\[2\]:/);
    expect(result).toContain("  - $question");
    expect(result).toContain("  - $documents");
  });

  test("serializes constraints as array", () => {
    const result = serializeField("constraint", [
      "k=3 minimum results",
      "filter results older than 1 year"
    ], "  ");
    expect(result).toMatch(/^constraints\[2\]:/);
    expect(result).toContain("  - k=3 minimum results");
    expect(result).toContain("  - filter results older than 1 year");
  });

  test("serializes KEYWORD block as multi-line indented", () => {
    let result = serializeField("NEXT", "tokenize $question\nproject into vector space", "  ");
    expect(result).toMatch(/^NEXT\n/);
    expect(result).toContain("  tokenize $question");
    expect(result).toContain("  project into vector space");

    result = serializeField("conditions", {
      for: "item",
      in: "object",
      do: "print"
    }, "  ");
    expect(result).toMatch(/^conditions:\n/);
    expect(result).toMatch(/\s+FOR\n/);
    expect(result).toMatch(/\s+IN\n/);
    expect(result).toMatch(/\s+DO\n/);
    expect(result).toContain("    item");
    expect(result).toContain("    object");
    expect(result).toContain("    print");
  });

  test("serializes format field", () => {
    expect(serializeField("format", "markdown")).toBe("format: markdown");
  });

  test("serializes provenance field", () => {
    expect(serializeField("provenance", "extracted")).toBe("provenance: extracted");
  });

  test("serializes INPUT variable schema as PPL2 block", () => {
    const result = serializeField("schema", { id: "string", content: "string", source: "string" }, "  ");
    expect(result).toMatch(/^schema:\n/);
    expect(result).toContain("  id: string");
    expect(result).toContain("  content: string");
    expect(result).toContain("  source: string");
  });

  test("serializes OUTPUT schema with nested structure", () => {
    const result = serializeField("schema", {
      answer: "string",
      citations: "array",
      confidence: "number"
    }, "  ");
    expect(result).toMatch(/^schema:\n/);
    expect(result).toContain("  answer: string");
    expect(result).toContain("  citations: array");
    expect(result).toContain("  confidence: number");
  });

});

// ── serializeField — serializeVariable as objSerializer ──────────────────────

describe("serializeField — serializeVariable as objSerializer", () => {

  const serializeVariable = require("../../../src/utilities/serialize/serializeVariable");

  test("serializes variable object via serializeVariable", () => {
    const result = serializeField("input", { name: "question", description: "user question", format: "text" }, "  ", {
      objSerializer: serializeVariable
    });
    expect(result).toContain("$question");
    expect(result).toContain("description: user question");
    expect(result).toContain("format: text");
    expect(result).not.toContain("input");  // field name suppressed — serializeVariable owns output
  });

  test("single variable object unwrapped — no inputs[1] wrapper", () => {
    const result = serializeField("input", { name: "question", description: "user question" }, "  ", {
      objSerializer: serializeVariable
    });
    expect(result).not.toMatch(/^inputs\[1\]:/);
  });

  test("array of variable objects serialized via serializeVariable", () => {
    const result = serializeField("input", [
      { name: "question", description: "user question" },
      { name: "documents", description: "knowledge base" }
    ], "  ", {
      createArray: true,
      objSerializer: serializeVariable
    });
    expect(result).toContain("$question");
    expect(result).toContain("$documents");
  });

});

// ── createObjectSerializer — FULL_SERIALIZER flag ─────────────────────────────

describe("createObjectSerializer — FULL_SERIALIZER flag", () => {

  test("serializeObject has FULL_SERIALIZER flag", () => {
    expect(serializeObject.FULL_SERIALIZER).toBe(true);
  });

  test("createObjectSerializer returns input directly if FULL_SERIALIZER set", () => {
    const result = createObjectSerializer(serializeObject);
    expect(result).toBe(serializeObject);
  });

  test("createObjectSerializer wraps function without FULL_SERIALIZER", () => {
    const custom = o => `${o.key}`;
    const result = createObjectSerializer(custom);
    expect(result).not.toBe(custom);
    expect(typeof result).toBe("function");
  });

  test("wrapped serializer also gets FULL_SERIALIZER flag", () => {
    const custom = o => `${o.key}`;
    const result = createObjectSerializer(custom);
    expect(result.FULL_SERIALIZER).toBe(true);
  });

  test("passing FULL_SERIALIZER serializer via objSerializer uses it directly", () => {
    const result = serializeField("data", { key: "hello" }, "  ", {
      objSerializer: serializeObject
    });
    expect(result).toContain("key: hello");
  });

});

// ── serializeArray — custom objSerializer ────────────────────────────────────

describe("serializeArray — custom objSerializer", () => {

  test("uses default _serializeObject for object items", () => {
    const result = serializeArray("item", [{ key: "value" }], "  ");
    expect(result).toContain("key: value");
  });

  test("uses custom objSerializer for object items", () => {
    const result = serializeArray("item", [{ key: "hello" }, { key: "world" }], "  ", o => o.key);
    expect(result).toContain("hello");
    expect(result).toContain("world");
  });

  test("mixes object and primitive items", () => {
    const result = serializeArray("item", ["plain", { key: "obj" }], "  ");
    expect(result).toContain("plain");
    expect(result).toContain("key: obj");
  });

});

// ── module contract ───────────────────────────────────────────────────────────

describe("module contract", () => {

  test("exports a function", () => {
    expect(typeof serializeField).toBe("function");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(serializeField)).toBe(true);
  });

  test("has self-referential serializeField property", () => {
    expect(serializeField.serializeField).toBe(serializeField);
  });

  test("self-referential property is non-writable", () => {
    const desc = Object.getOwnPropertyDescriptor(serializeField, "serializeField");
    expect(desc.writable).toBe(false);
  });

  test("self-referential property is non-configurable", () => {
    const desc = Object.getOwnPropertyDescriptor(serializeField, "serializeField");
    expect(desc.configurable).toBe(false);
  });

  test("exposes normalizeNewlines as a property", () => {
    expect(typeof serializeField.normalizeNewlines).toBe("function");
  });

  test("exposes serializeText as a property", () => {
    expect(typeof serializeField.serializeText).toBe("function");
  });

  test("exposes serializeArray as a property", () => {
    expect(typeof serializeField.serializeArray).toBe("function");
  });

  test("exposes createObjectSerializer as a property", () => {
    expect(typeof serializeField.createObjectSerializer).toBe("function");
  });

  test("exposes serializeObject as a property", () => {
    expect(typeof serializeField.serializeObject).toBe("function");
  });

  test("normalizeNewlines property is the actual normalizeNewlines function", () => {
    expect(serializeField.normalizeNewlines("  hello  ")).toBe("hello");
    expect(serializeField.normalizeNewlines("a\n\n\nb")).toBe("a\n\nb");
    expect(serializeField.normalizeNewlines("Line 1\n   \nLine 2")).toBe("Line 1\n\nLine 2");
  });

});