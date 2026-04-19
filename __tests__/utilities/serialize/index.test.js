"use strict";

const serialize = require("../../../src/utilities/serialize/index");

// ── helpers ───────────────────────────────────────────────────────────────────

const minimalGoal = {
  steps: {
    search: {
      do: ["retrieve top k"]
    }
  }
};

const minimalOutput = { answer: "final answer" }; // --> converted automatically into { description: "final answer" }
const minimalInput  = { question: { description: "user question" } };

const minimalObj = {
  goals:   {
    answer_from_kb: minimalGoal
  },
  outputs: [minimalOutput]
};

const fullExample = {

  WHY: {
    because: "test"
  },

  inputs: {
    question: {
      description: "user question to answer",
      format: "text",
      provenance: "extracted"
    },

    documents: {
      description: "knowledge base documents",
      format: "json",
      schema: {
        id: "string",
        content: "string",
        source: "string"
      }
    }
  },

  goals: {

    answer_from_kb: {

      role: "research assistant",

      description:
        "answer user question using knowledge base",

      inputs: [
        "$question",
        "$documents"
      ],

      outputs: [
        "$answer",
        "$confidence"
      ],

      constraints: [
        "confidence must be above 0.6",
        "always cite sources"
      ],

      steps: {

        embed: {

          description:
            "embed question into vector space",

          inputs: [
            "$question"
          ],

          outputs: [
            "$embedded"
          ],

          do:
            "tokenize $question\n" +
            "project into vector space\n" +
            "normalize embedding"
        },

        search_kb: {

          description:
            "retrieve top k documents",

          inputs: [
            "$embedded",
            "$documents"
          ],

          outputs: [
            "$results"
          ],

          constraints: [
            "k=3 minimum results"
          ],

          do: [
            "compute cosine similarity against all documents",
            "rank by score",
            "return top k"
          ]
        },

        check_relevance: {

          description:
            "score results and route to appropriate next step",

          inputs: [
            "$results"
          ],

          outputs: [
            "$relevance_score"
          ],

          do:
            "score each result for relevance\n" +
            "compute overall $relevance_score",

          next:
            "IF $relevance_score >= 0.7 THEN GOTO @generate_from_kb\n" +
            "ELSE GOTO @web_search"
        },

        generate_from_kb: {

          description:
            "synthesize answer from knowledge base results",

          inputs: [
            "$results"
          ],

          outputs: [
            "$answer",
            "$confidence"
          ],

          provenance: "inferred",

          constraints: [
            "IF $confidence < 0.6 THEN state uncertainty",
            "always cite sources"
          ],

          do: [
            "synthesize $answer from $results",
            "compute $confidence score",
            "attach citations"
          ],

          next: [
            "IF $confidence < 0.4 THEN GOTO @web_search",
            "ELSE GOTO @format_answer"
          ]
        },

        web_search: {

          role: "web researcher",

          description:
            "search web as fallback when knowledge base insufficient",

          inputs: [
            "$question"
          ],

          outputs: [
            "$web_answer",
            "$confidence"
          ],

          constraints: [
            "max 5 results",
            "filter results older than 1 year"
          ],

          do:
            "search web for $question\n" +
            "extract and synthesize $web_answer"
        },

        format_answer: {

          description:
            "format and validate answer before returning",

          inputs: [
            "$answer"
          ],

          outputs: [
            "$formatted_answer"
          ],

          substeps: {

            apply_markdown: {

              description:
                "apply markdown formatting",

              inputs: [
                "$answer"
              ],

              outputs: [
                "$markdown_answer"
              ],

              do:
                "wrap headers\n" +
                "add citation links\n" +
                "format code blocks"
            },

            validate_citations: {

              description:
                "verify all citations are present and valid",

              inputs: [
                "$markdown_answer"
              ],

              outputs: [
                "$formatted_answer",
                "$missing_citations"
              ],

              do: [
                "check each citation resolves to a source",
                "count missing citations into $missing_citations"
              ],

              next:
                "IF $missing_citations > 0 THEN GOTO @generate_from_kb\n" +
                "ELSE CONTINUE"
            }
          }
        }
      }
    },

    verify_answer: {

      role: "fact checker",

      description:
        "verify answer quality and grounding before returning",

      inputs: [
        "$formatted_answer"
      ],

      outputs: [
        "$verified_answer"
      ],

      steps: {

        check_grounding: {

          description:
            "verify answer is grounded in retrieved results",

          inputs: [
            "$formatted_answer"
          ],

          outputs: [
            "$grounding_score"
          ],

          provenance: "inferred",

          conditions: [
            "$formatted_answer is not empty"
          ],

          do: [
            "verify $formatted_answer is consistent",
            "compute $grounding_score"
          ],

          next:
            "IF $grounding_score < 0.7 THEN GOTO @answer_from_kb\n" +
            "ELSE GOTO @finalize"
        },

        finalize: {

          description:
            "finalize and bind verified answer",

          inputs: [
            "$formatted_answer"
          ],

          outputs: [
            "$verified_answer"
          ],

          do:
            "bind $formatted_answer to $verified_answer"
        }
      }
    }
  },

  outputs: {

    verified_answer: {

      description:
        "final verified answer with citations",

      format: "json",

      provenance: "inferred",

      schema: {
        answer: "string",
        citations: "array",
        confidence: "number"
      }
    }
  }
};

console.log(serialize(fullExample));

// test("dummy", () => {
//   expect(true).toBe(true);
// });
// return;


// ── invalid input ─────────────────────────────────────────────────────────────

describe("serialize — invalid input", () => {

  test("returns empty string for null", () => {
    expect(serialize(null)).toBe("");
  });

  test("returns empty string for undefined", () => {
    expect(serialize(undefined)).toBe("");
  });

  test("returns empty string for false", () => {
    expect(serialize(false)).toBe("");
  });

  test("throws when outputs missing at root", () => {
    expect(() => serialize({ goals: [minimalGoal] })).toThrow();
  });

  test("throws when goals missing at root", () => {
    expect(() => serialize({ outputs: [minimalOutput] })).toThrow();
  });

  test("throws when block has both do and children", () => {
    expect(() => serialize({
      goals: [{
        name: "x",
        type: "GOAL",
        do: "something",
        steps: [{ name: "s", type: "STEP", do: "step" }]
      }],
      outputs: [minimalOutput]
    })).toThrow();
  });

  test("throws when child block type field is not an object", () => {
    expect(() => serialize({
      goals: "not an object",
      outputs: [minimalOutput]
    })).toThrow();
  });

  test("throws when both goals and steps defined at same level", () => {
    expect(() => serialize({
      goals:   [minimalGoal],
      steps:   [{ name: "s", type: "STEP", do: "x" }],
      outputs: [minimalOutput]
    })).toThrow();
  });

});

// ── primitive and literal inputs ──────────────────────────────────────────────

describe("serialize — primitive inputs", () => {

  test("serializes a string literal", () => {
    expect(serialize("hello", { root: false })).toBe("hello");
  });

  test("serializes a number literal", () => {
    expect(serialize(42, { root: false })).toBe("42");
  });

  test("trims string literal", () => {
    expect(serialize("  hello  ", { root: false })).toBe("hello");
  });

  test("re-indents multi-line string with indent", () => {
    const result = serialize("line1\nline2", { root: false, indent: "  " });
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });

  test("serializes true as string", () => {
    expect(serialize(true, { root: false })).toBe("true");
  });

});

// ── array input ───────────────────────────────────────────────────────────────

describe("serialize — array input", () => {

  test("serializes array of strings", () => {
    const result = serialize(["a", "b"], { root: false });
    expect(result).toContain("a");
    expect(result).toContain("b");
  });

  test("array items prefixed with - ", () => {
    const result = serialize(["a", "b"], { root: false });
    expect(result).toContain("- ");
  });

});

// ── output structure ──────────────────────────────────────────────────────────

describe("serialize — output structure", () => {

  test("contains output keyword (not OUTPOUT) when variables are mentioned, not defined", () => {
    expect(serialize(minimalObj)).toContain("output");
  });

  test("contains GOALS keyword", () => {
    expect(serialize(minimalObj)).toContain("GOALS");
  });

  test("contains input keyword (not INPUT) when variables are mentioned, not defined", () => {
    const result = serialize({
      inputs:  [minimalInput],
      goals:   [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("input");
  });

  test("omits INPUT keyword when no inputs provided", () => {
    expect(serialize(minimalObj)).not.toContain("INPUT ");
  });

  test("INPUT appears before GOALS", () => {
    const result = serialize({
      inputs:  [minimalInput],
      goals:   [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result.indexOf("INPUT")).toBeLessThan(result.indexOf("GOALS"));
  });

  test("OUTPUT appears before GOALS", () => {
    const result = serialize(minimalObj);
    expect(result.indexOf("OUTPUT")).toBeLessThan(result.indexOf("GOALS"));
  });

});

// ── block and variable names ───────────────────────────────────────────────────

describe("serialize — block and variable names", () => {

  test("goal block name appears as @name", () => {
    expect(serialize(minimalObj)).toContain("@answer_from_kb");
  });

  test("output variable name appears as $name", () => {
    expect(serialize(minimalObj)).toContain("$answer");
  });

  test("input variable name appears as $name", () => {
    const result = serialize({
      inputs:  [minimalInput],
      goals:   [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("$question");
  });

  test("step block name appears as @name", () => {
    expect(serialize(minimalObj)).toContain("@search");
  });

  test("block names are normalized to snake_case", () => {
    const result = serialize({
      goals: {
        myGoalName: {
          steps: {
            myStep: { do: "x" }
          }
        }
      },
      outputs: { answer: { description: "final answer" } }
    });
    expect(result).toContain("@my_goal_name");
    expect(result).toContain("@my_step");
  });

});

// ── child block keywords ──────────────────────────────────────────────────────

describe("serialize — child block keywords", () => {

  test("uses GOALS keyword for goals array", () => {
    expect(serialize(minimalObj)).toContain("GOALS");
  });

  test("uses STEPS keyword for steps array", () => {
    expect(serialize(minimalObj)).toContain("STEPS");
  });

  test("uses SUBSTEPS keyword for substeps array", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        steps: [{
          name: "s",
          type: "STEP",
          substeps: [{ name: "ss", type: "SUBSTEP", do: "x" }]
        }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("SUBSTEPS");
  });

  test("uses TASKS keyword for tasks array", () => {
    const result = serialize({
      tasks:   [{ name: "t", type: "TASK", do: "x" }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("TASKS");
  });

});

// ── DO and NEXT ────────────────────────────────────────────────────────────────

describe("serialize — DO and NEXT", () => {

  test("DO keyword appears for do field", () => {
    expect(serialize(minimalObj)).toContain("DO");
  });

  test("DO content appears after DO keyword", () => {
    const result = serialize(minimalObj);
    expect(result.indexOf("DO")).toBeLessThan(result.indexOf("retrieve top k"));
  });

  test("NEXT keyword appears for next field", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        steps: [{
          name: "s",
          type: "STEP",
          do:   "compute",
          next: "IF x THEN GOTO @end"
        }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("NEXT");
    expect(result).toContain("IF x THEN GOTO @end");
  });

  test("DO as array serializes each item with - prefix", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        steps: [{
          name: "s",
          type: "STEP",
          do:   ["step one", "step two"]
        }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("- step one");
    expect(result).toContain("- step two");
  });

});

// ── known fields ──────────────────────────────────────────────────────────────

describe("serialize — known fields", () => {

  test("description field appears in output", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        description: "my description",
        steps: [{ name: "s", type: "STEP", do: "x" }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("description: my description");
  });

  test("role field appears in output", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        role: "researcher",
        steps: [{ name: "s", type: "STEP", do: "x" }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("role: researcher");
  });

  test("provenance field appears in output", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        provenance: "inferred",
        steps: [{ name: "s", type: "STEP", do: "x" }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("provenance: inferred");
  });

  test("constraints appear in output", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        constraints: ["must cite sources"],
        steps: [{ name: "s", type: "STEP", do: "x" }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("must cite sources");
  });

  test("conditions appear in output", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        conditions: ["input is not empty"],
        steps: [{ name: "s", type: "STEP", do: "x" }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("input is not empty");
  });

  test("comments serialized with # prefix", () => {
    const result = serialize({
      goals: [{
        name: "g",
        type: "GOAL",
        comments: "this is a comment",
        steps: [{ name: "s", type: "STEP", do: "x" }]
      }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("# this is a comment");
  });

  test("schema serialized as block", () => {
    const result = serialize({
      goals:   [minimalGoal],
      outputs: [{
        name:   "answer",
        format: "json",
        schema: { answer: "string", confidence: "number" }
      }]
    });
    expect(result).toContain("|");
    expect(result).toContain('"answer"');
  });

  test("format lowercased", () => {
    const result = serialize({
      goals:   [minimalGoal],
      outputs: [{ name: "answer", format: "JSON" }]
    });
    expect(result).toContain("format: json");
  });

  test("unknown keys serialized via other", () => {
    const result = serialize({
      goals:   [minimalGoal],
      outputs: [minimalOutput],
      why: { because: "test" }
    });
    expect(result).toContain("because");
    expect(result).toContain("test");
  });

});

// ── serializeKeywordField — true guard ────────────────────────────────────────

describe("serialize — true value guard", () => {

  test("boolean true value produces no output for keyword field", () => {
    const result = serialize({
      goals:   [{ name: "g", type: "GOAL", do: true, steps: undefined }],
      outputs: [minimalOutput]
    });
    // Should not throw and should not contain bare "DO" with no content
    expect(result).not.toMatch(/DO\s*\n\s*\n/);
  });

});

// ── options ───────────────────────────────────────────────────────────────────

describe("serialize — options", () => {

  test("uses default indent of two spaces", () => {
    const result = serialize(minimalObj);
    // At least one indented line exists
    expect(result).toMatch(/^  \S/m);
  });

  test("uses custom indent", () => {
    const result = serialize(minimalObj, { indent: "    " });
    expect(result).toMatch(/^    \S/m);
  });

  test("root defaults to true — validation active", () => {
    expect(() => serialize({ goals: [minimalGoal] })).toThrow();
  });

  test("root: false disables validation", () => {
    expect(() => serialize({ goals: [minimalGoal] }, { root: false })).not.toThrow();
  });

});

// ── module contract ───────────────────────────────────────────────────────────

describe("module contract", () => {

  test("exports a function", () => {
    expect(typeof serialize).toBe("function");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(serialize)).toBe(true);
  });

  test("has self-referential serialize property", () => {
    expect(serialize.serialize).toBe(serialize);
  });

  test("self-referential property is non-writable", () => {
    const desc = Object.getOwnPropertyDescriptor(serialize, "serialize");
    expect(desc.writable).toBe(false);
  });

  test("self-referential property is non-configurable", () => {
    const desc = Object.getOwnPropertyDescriptor(serialize, "serialize");
    expect(desc.configurable).toBe(false);
  });

});