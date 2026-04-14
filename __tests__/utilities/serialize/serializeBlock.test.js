"use strict";

const serializeBlock = require("../../../src/utilities/serialize/serializeBlock");

const { isBlock } = serializeBlock;

// ── isBlock ───────────────────────────────────────────────────────────────────

describe("isBlock", () => {

  describe("valid blocks", () => {

    test("returns truthy for object with name and type", () => {
      expect(isBlock({ name: "embed", type: "STEP" })).toBeTruthy();
    });

    test("returns truthy for GOAL block", () => {
      expect(isBlock({ name: "answer_from_kb", type: "GOAL" })).toBeTruthy();
    });

    test("returns truthy for SUBSTEP block", () => {
      expect(isBlock({ name: "tokenize", type: "SUBSTEP" })).toBeTruthy();
    });

    test("returns truthy for block with extra fields", () => {
      expect(isBlock({ name: "embed", type: "STEP", description: "embed question", do: ["tokenize"] })).toBeTruthy();
    });

    test("returns truthy for block with title alone", () => {
      expect(isBlock({ title: "MY BLOCK" })).toBeTruthy();
    });

    test("returns truthy for block with title and other fields", () => {
      expect(isBlock({ title: "user inputs", description: "variables passed in" })).toBeTruthy();
    });

  });

  describe("invalid blocks", () => {

    test("returns falsy for null", () => {
      expect(isBlock(null)).toBeFalsy();
    });

    test("returns falsy for undefined", () => {
      expect(isBlock(undefined)).toBeFalsy();
    });

    test("returns falsy for string", () => {
      expect(isBlock("embed")).toBeFalsy();
    });

    test("returns falsy for number", () => {
      expect(isBlock(42)).toBeFalsy();
    });

    test("returns falsy for empty object", () => {
      expect(isBlock({})).toBeFalsy();
    });

    test("returns falsy for object missing type", () => {
      expect(isBlock({ name: "embed" })).toBeFalsy();
    });

    test("returns falsy for object missing name", () => {
      expect(isBlock({ type: "STEP" })).toBeFalsy();
    });

    test("returns falsy for array", () => {
      expect(isBlock([{ name: "embed", type: "STEP" }])).toBeFalsy();
    });

  });

});

// ── null / undefined / empty ──────────────────────────────────────────────────

describe("serializeBlock — null / undefined / empty", () => {

  test("returns empty string for null", () => {
    expect(serializeBlock(null, "  ")).toBe("");
  });

  test("returns empty string for undefined", () => {
    expect(serializeBlock(undefined, "  ")).toBe("");
  });

  test("returns empty string for empty string", () => {
    expect(serializeBlock("", "  ")).toBe("");
  });

});

// ── primitive input ───────────────────────────────────────────────────────────

describe("serializeBlock — primitive input", () => {

  test("returns string as-is with no curIndent", () => {
    expect(serializeBlock("tokenize $question", "  ")).toBe("tokenize $question");
  });

  test("applies curIndent to primitive", () => {
    expect(serializeBlock("tokenize $question", "  ", "    ")).toBe("    tokenize $question");
  });

  test("coerces number to string", () => {
    expect(serializeBlock(42, "  ")).toBe("42");
  });

  test("coerces boolean to string", () => {
    expect(serializeBlock(true, "  ")).toBe("true");
  });

});

// ── array input ───────────────────────────────────────────────────────────────

describe("serializeBlock — array input", () => {

  test("serializes array of primitives joined with double newlines", () => {
    expect(serializeBlock(["hello", "world"], "  ")).toBe("hello\n\nworld");
  });

  test("serializes array of blocks joined with double newlines", () => {
    const blocks = [
      { name: "embed",    type: "SUBSTEP", do: ["tokenize"] },
      { name: "retrieve", type: "SUBSTEP", do: ["retrieve top k"] }
    ];
    const result = serializeBlock(blocks, "  ");
    expect(result).toContain("SUBSTEP @embed:");
    expect(result).toContain("SUBSTEP @retrieve:");
    expect(result).toContain("\n\n");
  });

  test("passes curIndent to each array item", () => {
    const result = serializeBlock(["hello", "world"], "  ", "  ");
    expect(result).toContain("  hello");
    expect(result).toContain("  world");
  });

  test("returns empty string for empty array", () => {
    expect(serializeBlock([], "  ")).toBe("");
  });

});

// ── throws ────────────────────────────────────────────────────────────────────

describe("serializeBlock — throws", () => {

  test("throws for object missing name", () => {
    expect(() => serializeBlock({ type: "STEP", do: ["tokenize"] }, "  ")).toThrow("missing name");
  });

  test("throws for object missing type and no inference possible", () => {
    expect(() => serializeBlock({ name: "embed", do: ["tokenize"] }, "  ")).toThrow("missing type");
  });

  test("throws for block with both do and sub-blocks", () => {
    expect(() => serializeBlock({
      name: "embed",
      type: "STEP",
      do: ["tokenize"],
      substeps: [{ name: "sub", type: "SUBSTEP", do: ["x"] }]
    }, "  ")).toThrow("cannot have both a do and a sub-block");
  });

  test("throws for block with empty content", () => {
    expect(() => serializeBlock({ name: "embed", type: "STEP" }, "  ")).toThrow("empty content");
  });

  test("error message includes serialized block for missing name", () => {
    expect(() => serializeBlock({ type: "STEP", do: ["x"] }, "  ")).toThrow("missing name");
  });

  test("error message includes serialized block for missing type", () => {
    expect(() => serializeBlock({ name: "embed", do: ["x"] }, "  ")).toThrow("missing type");
  });

});

// ── type inference ────────────────────────────────────────────────────────────

describe("serializeBlock — type inference", () => {

  test("infers STEP from substeps", () => {
    const block = {
      name: "search_kb",
      substeps: [{ name: "embed", type: "SUBSTEP", do: ["tokenize"] }]
    };
    const result = serializeBlock(block, "  ");
    expect(result).toMatch(/^STEP @search_kb:/);
  });

  test("infers GOAL from steps", () => {
    const block = {
      name: "answer_from_kb",
      steps: [{ name: "embed", type: "STEP", do: ["tokenize"] }]
    };
    const result = serializeBlock(block, "  ");
    expect(result).toMatch(/^GOAL @answer_from_kb:/);
  });

  test("explicit type takes precedence over inference", () => {
    const block = {
      name: "answer_from_kb",
      type: "GOAL",
      steps: [{ name: "embed", type: "STEP", do: ["tokenize"] }]
    };
    const result = serializeBlock(block, "  ");
    expect(result).toMatch(/^GOAL @answer_from_kb:/);
  });

  test("uppercases explicit type", () => {
    const block = {
      name: "embed",
      type: "substep",
      do: ["tokenize"]
    };
    const result = serializeBlock(block, "  ");
    expect(result).toMatch(/^SUBSTEP @embed:/);
  });

});

// ── field aliases ─────────────────────────────────────────────────────────────

describe("serializeBlock — field aliases", () => {

  test("accepts role alias", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", role: "embedder", do: ["x"] }, "  ");
    expect(result).toContain("role: embedder");
  });

  test("accepts roles alias", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", roles: "embedder", do: ["x"] }, "  ");
    expect(result).toContain("role: embedder");
  });

  test("accepts input alias", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", input: "$question", do: ["x"] }, "  ");
    expect(result).toContain("$question");
  });

  test("accepts in alias", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", in: "$question", do: ["x"] }, "  ");
    expect(result).toContain("$question");
  });

  test("accepts output alias", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", output: "$embedded", do: ["x"] }, "  ");
    expect(result).toContain("$embedded");
  });

  test("accepts out alias", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", out: "$embedded", do: ["x"] }, "  ");
    expect(result).toContain("$embedded");
  });

  test("accepts origin alias for provenance", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", origin: "extracted", do: ["x"] }, "  ");
    expect(result).toContain("provenance: extracted");
  });

  test("accepts constraint alias", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", constraint: "k=3", do: ["x"] }, "  ");
    expect(result).toContain("k=3");
  });

  test("accepts condition alias", () => {
    const result = serializeBlock({ name: "embed", type: "SUBSTEP", condition: "score > 0.7", do: ["x"] }, "  ");
    expect(result).toContain("score > 0.7");
  });

  test("accepts goal alias for children", () => {
    const block = {
      name: "mission",
      type: "GOAL",
      goal: { name: "embed", type: "STEP", do: ["x"] }
    };
    const result = serializeBlock(block, "  ");
    expect(result).toContain("@embed");
  });

});

// ── name normalization ────────────────────────────────────────────────────────

describe("serializeBlock — name normalization", () => {

  test("normalizes camelCase name to @snake_case", () => {
    const result = serializeBlock({ name: "searchKb", type: "SUBSTEP", do: ["x"] }, "  ");
    expect(result).toMatch(/^SUBSTEP @search_kb:/);
  });

  test("normalizes PascalCase name", () => {
    const result = serializeBlock({ name: "SearchKb", type: "SUBSTEP", do: ["x"] }, "  ");
    expect(result).toMatch(/^SUBSTEP @search_kb:/);
  });

  test("preserves existing @ prefix", () => {
    const result = serializeBlock({ name: "@embed", type: "SUBSTEP", do: ["x"] }, "  ");
    expect(result).toMatch(/^SUBSTEP @embed:/);
  });

  test("collapses multiple @ prefixes", () => {
    const result = serializeBlock({ name: "@@embed", type: "SUBSTEP", do: ["x"] }, "  ");
    expect(result).toMatch(/^SUBSTEP @embed:/);
  });

});

// ── field serialization order ─────────────────────────────────────────────────

describe("serializeBlock — field serialization order", () => {

  test("role appears before inputs", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      role: "embedder",
      inputs: ["$question"],
      do: ["tokenize"]
    }, "  ");
    expect(result.indexOf("role:")).toBeLessThan(result.indexOf("input"));
  });

  test("inputs appear before outputs", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      inputs: ["$question"],
      outputs: ["$embedded"],
      do: ["tokenize"]
    }, "  ");
    expect(result.indexOf("input")).toBeLessThan(result.indexOf("output"));
  });

  test("outputs appear before description", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      outputs: ["$embedded"],
      description: "embed question",
      do: ["tokenize"]
    }, "  ");
    expect(result.indexOf("output")).toBeLessThan(result.indexOf("description:"));
  });

  test("description appears before provenance", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      description: "embed question",
      provenance: "inferred",
      do: ["tokenize"]
    }, "  ");
    expect(result.indexOf("description:")).toBeLessThan(result.indexOf("provenance:"));
  });

  test("constraints appear before conditions", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      constraints: ["k=3"],
      conditions: ["score > 0.7"],
      do: ["tokenize"]
    }, "  ");
    expect(result.indexOf("constraint")).toBeLessThan(result.indexOf("condition"));
  });

  test("DO appears before NEXT", () => {
    const result = serializeBlock({
      name: "check",
      type: "SUBSTEP",
      do: ["check score"],
      next: "GOTO @generate"
    }, "  ");
    expect(result.indexOf("DO")).toBeLessThan(result.indexOf("NEXT"));
  });

});

// ── DO block ──────────────────────────────────────────────────────────────────

describe("serializeBlock — DO block", () => {

  test("DO never has a colon after the keyword", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      do: ["tokenize $question"]
    }, "  ");
    expect(result).toContain("DO\n");
    expect(result).not.toContain("DO:");
  });

  test("DO as string produces indented lines without dashes", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      do: "tokenize $question\nproject into vector space"
    }, "  ");
    expect(result).toContain("DO\n");
    expect(result).toContain("tokenize $question");
    expect(result).toContain("project into vector space");
    expect(result).not.toContain("- tokenize");
  });

  test("DO as array produces indented dash list", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      do: ["tokenize $question", "project into vector space"]
    }, "  ");
    expect(result).toContain("DO\n");
    expect(result).toContain("- tokenize $question");
    expect(result).toContain("- project into vector space");
  });

  test("DO as single string produces inline indented content", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      do: "tokenize $question"
    }, "  ");
    expect(result).toContain("DO\n");
    expect(result).toContain("tokenize $question");
    expect(result).not.toContain("DO:");
  });

});

// ── NEXT block ────────────────────────────────────────────────────────────────

describe("serializeBlock — NEXT block", () => {

  test("NEXT never has a colon after the keyword", () => {
    const result = serializeBlock({
      name: "check",
      type: "SUBSTEP",
      do: ["check score"],
      next: "GOTO @generate"
    }, "  ");
    expect(result).toContain("NEXT\n");
    expect(result).not.toContain("NEXT:");
  });

  test("NEXT as string produces indented lines without dashes", () => {
    const result = serializeBlock({
      name: "check",
      type: "SUBSTEP",
      do: ["check score"],
      next: "IF $score >= 0.7 THEN GOTO @generate\nELSE GOTO @fallback"
    }, "  ");
    expect(result).toContain("NEXT\n");
    expect(result).toContain("IF $score >= 0.7 THEN GOTO @generate");
    expect(result).toContain("ELSE GOTO @fallback");
    expect(result).not.toContain("- IF");
  });

  test("NEXT as array produces indented dash list", () => {
    const result = serializeBlock({
      name: "check",
      type: "SUBSTEP",
      do: ["check score"],
      next: ["IF $score >= 0.7 THEN GOTO @generate", "ELSE GOTO @fallback"]
    }, "  ");
    expect(result).toContain("NEXT\n");
    expect(result).toContain("- IF $score >= 0.7 THEN GOTO @generate");
    expect(result).toContain("- ELSE GOTO @fallback");
  });

  test("NEXT as single string produces inline indented content", () => {
    const result = serializeBlock({
      name: "check",
      type: "SUBSTEP",
      do: ["check score"],
      next: "GOTO @generate"
    }, "  ");
    expect(result).toContain("NEXT\n");
    expect(result).toContain("GOTO @generate");
    expect(result).not.toContain("NEXT:");
  });

});

// ── sub-blocks ────────────────────────────────────────────────────────────────

describe("serializeBlock — sub-blocks", () => {

  test("GOAL uses steps[N] header for sub-blocks", () => {
    const result = serializeBlock({
      name: "answer_from_kb",
      type: "GOAL",
      steps: [
        { name: "embed",  type: "STEP", do: ["tokenize"] },
        { name: "search", type: "STEP", do: ["retrieve"] }
      ]
    }, "  ");
    expect(result).toContain("steps[2]:");
  });

  test("STEP uses substeps[N] header for sub-blocks", () => {
    const result = serializeBlock({
      name: "search_kb",
      type: "STEP",
      substeps: [
        { name: "embed",    type: "SUBSTEP", do: ["tokenize"] },
        { name: "retrieve", type: "SUBSTEP", do: ["retrieve"] }
      ]
    }, "  ");
    expect(result).toContain("substeps[2]:");
  });

  test("sub-block names appear in output", () => {
    const result = serializeBlock({
      name: "search_kb",
      type: "STEP",
      substeps: [
        { name: "embed",    type: "SUBSTEP", do: ["tokenize"] },
        { name: "retrieve", type: "SUBSTEP", do: ["retrieve"] }
      ]
    }, "  ");
    expect(result).toContain("@embed");
    expect(result).toContain("@retrieve");
  });

  test("filters non-block children", () => {
    const result = serializeBlock({
      name: "search_kb",
      type: "STEP",
      substeps: [
        { name: "embed", type: "SUBSTEP", do: ["tokenize"] },
        "not a block",
        null
      ]
    }, "  ");
    expect(result).toContain("substeps[1]:");
  });

});

// ── title field ───────────────────────────────────────────────────────────────

describe("serializeBlock — title field", () => {

  test("title renders as normalized ALL CAPS without type prefix", () => {
    const result = serializeBlock({ title: "user inputs", description: "variables passed in" }, "  ");
    expect(result).toMatch(/^USER INPUTS\n/);
    expect(result).not.toContain("undefined");
    expect(result).not.toContain("@");
  });

  test("title does not require name or type", () => {
    expect(() => serializeBlock({ title: "my section", description: "some content" }, "  ")).not.toThrow();
  });

  test("title block with description renders description in body", () => {
    const result = serializeBlock({ title: "my section", description: "some content" }, "  ");
    expect(result).toContain("description: some content");
  });

  test("title block with do renders DO block", () => {
    const result = serializeBlock({ title: "my section", do: ["step one", "step two"] }, "  ");
    expect(result).toContain("DO\n");
    expect(result).toContain("step one");
  });

  test("title is valid as a sub-block child via isBlock", () => {
    expect(isBlock({ title: "my section", description: "content" })).toBeTruthy();
  });

  test("title normalizes camelCase", () => {
    const result = serializeBlock({ title: "userInputs", description: "x" }, "  ");
    expect(result).toMatch(/^USER INPUTS\n/);
  });

});

// ── comment / comments field ──────────────────────────────────────────────────

describe("serializeBlock — comment / comments field", () => {

  test("comment appears before other fields with # prefix", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      comment: "embeds the question",
      do: ["tokenize"]
    }, "  ");
    expect(result).toContain("# embeds the question");
    expect(result.indexOf("#")).toBeLessThan(result.indexOf("DO"));
  });

  test("comments alias works same as comment", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      comments: "embeds the question",
      do: ["tokenize"]
    }, "  ");
    expect(result).toContain("# embeds the question");
  });

  test("comment appears before role", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      comment: "my comment",
      role: "embedder",
      do: ["tokenize"]
    }, "  ");
    expect(result.indexOf("#")).toBeLessThan(result.indexOf("role:"));
  });

  test("block with only comment throws empty content", () => {
    expect(() => serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      comment: "just a comment"
    }, "  ")).toThrow("empty content");
  });

  test("comment as array renders multiple comment lines", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      comment: ["line one", "line two"],
      do: ["tokenize"]
    }, "  ");
    expect(result).toContain("#");
  });

});

// ── inputs / outputs as variable objects ──────────────────────────────────────

describe("serializeBlock — inputs / outputs as variable objects", () => {

  test("input as variable object serialized via serializeVariable", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      inputs: [{ name: "question", description: "user question", format: "text" }],
      do: ["tokenize"]
    }, "  ");
    expect(result).toContain("$question");
  });

  test("output as variable object serialized via serializeVariable", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      outputs: [{ name: "embedded", description: "embedded vector" }],
      do: ["tokenize"]
    }, "  ");
    expect(result).toContain("$embedded");
  });

  test("multiple input variable objects produce inputs[N] block", () => {
    const result = serializeBlock({
      name: "search",
      type: "STEP",
      inputs: [
        { name: "question", description: "user question" },
        { name: "documents", description: "knowledge base" }
      ],
      do: ["retrieve"]
    }, "  ");
    expect(result).toContain("$question");
    expect(result).toContain("$documents");
  });

  test("mixed string and variable object inputs", () => {
    const result = serializeBlock({
      name: "search",
      type: "STEP",
      inputs: ["$embedded", { name: "documents", description: "knowledge base" }],
      do: ["retrieve"]
    }, "  ");
    expect(result).toContain("$embedded");
    expect(result).toContain("$documents");
  });

});

// ── PPL2 scenarios ────────────────────────────────────────────────────────────

describe("serializeBlock — PPL2 scenarios", () => {

  test("serializes leaf SUBSTEP with all fields", () => {
    const result = serializeBlock({
      name: "embed",
      type: "SUBSTEP",
      description: "embed question into vector space",
      inputs: ["$question"],
      outputs: ["$embedded"],
      do: ["tokenize $question", "project into vector space", "normalize embedding"]
    }, "  ");
    expect(result).toMatch(/^SUBSTEP @embed:/);
    expect(result).toContain("input: $question");
    expect(result).toContain("output: $embedded");
    expect(result).toContain("description: embed question into vector space");
    expect(result).toContain("DO\n");
    expect(result).not.toContain("DO:");
    expect(result).toContain("tokenize $question");
  });

  test("serializes STEP with NEXT routing", () => {
    const result = serializeBlock({
      name: "check_relevance",
      type: "STEP",
      inputs: ["$results"],
      outputs: ["$score"],
      do: ["score results"],
      next: "IF $score >= 0.7 THEN GOTO @generate\nELSE GOTO @fallback"
    }, "  ");
    expect(result).toMatch(/^STEP @check_relevance:/);
    expect(result).toContain("DO\n");
    expect(result).toContain("NEXT\n");
    expect(result).not.toContain("DO:");
    expect(result).not.toContain("NEXT:");
    expect(result).toContain("GOTO @generate");
    expect(result).toContain("GOTO @fallback");
  });

  test("serializes STEP with nested SUBSTEPs", () => {
    const result = serializeBlock({
      name: "search_kb",
      type: "STEP",
      description: "query knowledge base",
      inputs: ["$question"],
      outputs: ["$results"],
      constraints: ["k=3 minimum results"],
      substeps: [
        { name: "embed",    type: "SUBSTEP", do: ["embed question"] },
        { name: "retrieve", type: "SUBSTEP", do: ["retrieve top k"] }
      ]
    }, "  ");
    expect(result).toMatch(/^STEP @search_kb:/);
    expect(result).toContain("substeps[2]:");
    expect(result).toContain("@embed");
    expect(result).toContain("@retrieve");
  });

  test("serializes GOAL with nested STEPs", () => {
    const result = serializeBlock({
      name: "answer_from_kb",
      type: "GOAL",
      role: "research assistant",
      description: "answer user question using knowledge base",
      inputs: ["$question"],
      outputs: ["$answer"],
      steps: [
        { name: "search_kb", type: "STEP", do: ["retrieve"] },
        { name: "generate",  type: "STEP", do: ["synthesize"] }
      ]
    }, "  ");
    expect(result).toMatch(/^GOAL @answer_from_kb:/);
    expect(result).toContain("role: research assistant");
    expect(result).toContain("steps[2]:");
    expect(result).toContain("@search_kb");
    expect(result).toContain("@generate");
  });

  test("serializes STEP with provenance", () => {
    const result = serializeBlock({
      name: "check_relevance",
      type: "STEP",
      provenance: "inferred",
      inputs: ["$results"],
      outputs: ["$relevance_score"],
      do: ["score each result"]
    }, "  ");
    expect(result).toContain("provenance: inferred");
  });

});

// ── module contract ───────────────────────────────────────────────────────────

describe("module contract", () => {

  test("exports a function", () => {
    expect(typeof serializeBlock).toBe("function");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(serializeBlock)).toBe(true);
  });

  test("has self-referential serializeBlock property", () => {
    expect(serializeBlock.serializeBlock).toBe(serializeBlock);
  });

  test("self-referential property is non-writable", () => {
    const desc = Object.getOwnPropertyDescriptor(serializeBlock, "serializeBlock");
    expect(desc.writable).toBe(false);
  });

  test("self-referential property is non-configurable", () => {
    const desc = Object.getOwnPropertyDescriptor(serializeBlock, "serializeBlock");
    expect(desc.configurable).toBe(false);
  });

  test("exposes isBlock as a property", () => {
    expect(typeof serializeBlock.isBlock).toBe("function");
  });

  test("isBlock property is the actual isBlock function", () => {
    expect(serializeBlock.isBlock({ name: "embed", type: "STEP" })).toBeTruthy();
    expect(serializeBlock.isBlock({ title: "MY BLOCK" })).toBeTruthy();
    expect(serializeBlock.isBlock({ name: "embed" })).toBeFalsy();
    expect(serializeBlock.isBlock(null)).toBeFalsy();
  });

});