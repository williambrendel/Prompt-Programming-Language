"use strict";

const serialize = require("../../../src/utilities/serialize/index");

// ── helpers ───────────────────────────────────────────────────────────────────

const minimalGoal = {
  name: "answer_from_kb",
  type: "GOAL",
  steps: [{ name: "search", type: "STEP", do: ["retrieve top k"] }]
};

const minimalOutput = { name: "answer", description: "final answer" };
const minimalInput  = { name: "question", description: "user question" };

const minimalObj = {
  goals:   [minimalGoal],
  outputs: [minimalOutput]
};

const fullExample = {
  inputs: [
    {
      name: "question",
      description: "user question to answer",
      format: "text",
      provenance: "extracted"
    },
    {
      name: "documents",
      description: "knowledge base documents",
      format: "json",
      schema: { id: "string", content: "string", source: "string" }
    }
  ],

  goals: [
    // ── GOAL 1: flat steps, no substeps ──────────────────────────────────────
    {
      name: "answer_from_kb",
      type: "GOAL",
      role: "research assistant",
      description: "answer user question using knowledge base",
      inputs: ["$question", "$documents"],
      outputs: ["$answer"],
      constraints: ["confidence must be above 0.6", "always cite sources"],
      steps: [

        // STEP with DO as string
        {
          name: "embed",
          type: "STEP",
          description: "embed question into vector space",
          inputs: ["$question"],
          outputs: ["$embedded"],
          do: "tokenize $question\nproject into vector space\nnormalize embedding"
        },

        // STEP with DO as array
        {
          name: "search_kb",
          type: "STEP",
          description: "retrieve top k documents",
          inputs: ["$embedded", "$documents"],
          outputs: ["$results"],
          constraints: ["k=3 minimum results"],
          do: [
            "compute cosine similarity against all documents",
            "rank by score",
            "return top k"
          ]
        },

        // STEP with NEXT as string (conditional routing)
        {
          name: "check_relevance",
          type: "STEP",
          description: "score results and route to appropriate next step",
          inputs: ["$results"],
          outputs: ["$relevance_score"],
          do: "score each result for relevance\ncompute overall $relevance_score",
          next: "IF $relevance_score >= 0.7 THEN GOTO @generate_from_kb\nELSE GOTO @web_search"
        },

        // STEP with DO as array + NEXT as array
        {
          name: "generate_from_kb",
          type: "STEP",
          description: "synthesize answer from knowledge base results",
          inputs: ["$results"],
          outputs: ["$answer"],
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

        // STEP with role + DO as string
        {
          name: "web_search",
          type: "STEP",
          description: "search web as fallback when knowledge base insufficient",
          role: "web researcher",
          inputs: ["$question"],
          outputs: ["$answer"],
          constraints: [
            "max 5 results",
            "filter results older than 1 year"
          ],
          do: "search web for $question\nextract and synthesize $answer"
        },

        // STEP with no DO, only sub-steps (substeps)
        {
          name: "format_answer",
          type: "STEP",
          description: "format and validate answer before returning",
          inputs: ["$answer"],
          outputs: ["$formatted_answer"],
          substeps: [

            // SUBSTEP with DO as string
            {
              name: "apply_markdown",
              type: "SUBSTEP",
              description: "apply markdown formatting",
              inputs: ["$answer"],
              outputs: ["$markdown_answer"],
              do: "wrap headers\nadd citation links\nformat code blocks"
            },

            // SUBSTEP with DO as array + NEXT
            {
              name: "validate_citations",
              type: "SUBSTEP",
              description: "verify all citations are present and valid",
              inputs: ["$markdown_answer"],
              outputs: ["$formatted_answer"],
              do: [
                "check each citation resolves to a source",
                "flag missing citations"
              ],
              next: "IF $missing_citations > 0 THEN GOTO @generate_from_kb\nELSE CONTINUE"
            }
          ]
        }
      ]
    },

    // ── GOAL 2: single step, no nesting ──────────────────────────────────────
    {
      name: "verify_answer",
      type: "GOAL",
      role: "fact checker",
      description: "verify answer quality and grounding before returning",
      inputs: ["$formatted_answer"],
      outputs: ["$verified_answer"],
      steps: [

        // STEP with conditions + DO as array
        {
          name: "check_grounding",
          type: "STEP",
          description: "verify answer is grounded in retrieved results",
          inputs: ["$formatted_answer"],
          outputs: ["$grounding_score"],
          provenance: "inferred",
          conditions: [
            "$formatted_answer is not empty",
            "$results contains at least one document"
          ],
          do: [
            "verify $formatted_answer is grounded in $results",
            "compute $grounding_score"
          ],
          next: "IF $grounding_score < 0.7 THEN GOTO @answer_from_kb\nELSE GOTO @finalize"
        },

        // STEP: simple leaf, DO as single string
        {
          name: "finalize",
          type: "STEP",
          description: "finalize and bind verified answer",
          inputs: ["$formatted_answer"],
          outputs: ["$verified_answer"],
          do: "bind $formatted_answer to $verified_answer"
        }
      ]
    }
  ],

  outputs: [
    {
      name: "verified_answer",
      description: "final verified answer with citations",
      format: "markdown",
      provenance: "inferred",
      schema: {
        answer: "string",
        citations: "array",
        confidence: "number"
      }
    }
  ]
};

console.log(serialize(fullExample));

// test("dummy", () => {
//   expect(true).toBe(true);
// });
// return;

// ── invalid input ─────────────────────────────────────────────────────────────

describe("serialize — invalid input", () => {

  test("throws for null", () => {
    expect(() => serialize(null)).toThrow("Invalid input");
  });

  test("throws for undefined", () => {
    expect(() => serialize(undefined)).toThrow("Invalid input");
  });

  test("throws for array", () => {
    expect(() => serialize([minimalObj])).toThrow("Invalid input");
  });

  test("throws for string", () => {
    expect(() => serialize("hello")).toThrow("Invalid input");
  });

  test("throws for number", () => {
    expect(() => serialize(42)).toThrow("Invalid input");
  });

  test("throws when outputs missing", () => {
    expect(() => serialize({ goals: [minimalGoal] })).toThrow();
  });

  test("throws when outputs empty array", () => {
    expect(() => serialize({ goals: [minimalGoal], outputs: [] })).toThrow();
  });

  test("throws when goals missing", () => {
    expect(() => serialize({ outputs: [minimalOutput] })).toThrow();
  });

  test("throws when goals empty array", () => {
    expect(() => serialize({ goals: [], outputs: [minimalOutput] })).toThrow();
  });

});

// ── field aliases ─────────────────────────────────────────────────────────────

describe("serialize — field aliases", () => {

  test("accepts input alias for inputs", () => {
    const result = serialize({
      input: [minimalInput],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("USER INPUTS");
  });

  test("accepts output alias for outputs", () => {
    const result = serialize({
      goals: [minimalGoal],
      output: [minimalOutput]
    });
    expect(result).toContain("RESULTS");
  });

  test("accepts toAchieve alias for goals", () => {
    const result = serialize({
      toAchieve: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("TO ACHIEVE");
  });

  test("accepts task alias for goals", () => {
    const result = serialize({
      task: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("TO ACHIEVE");
  });

  test("accepts tasks alias for goals", () => {
    const result = serialize({
      tasks: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("TO ACHIEVE");
  });

  test("accepts goal alias for goals", () => {
    const result = serialize({
      goal: minimalGoal,
      outputs: [minimalOutput]
    });
    expect(result).toContain("TO ACHIEVE");
  });

});

// ── section structure ─────────────────────────────────────────────────────────

describe("serialize — section structure", () => {

  test("always includes TO ACHIEVE section", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("TO ACHIEVE");
  });

  test("always includes RESULTS section", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("RESULTS");
  });

  test("omits USER INPUTS section when no inputs provided", () => {
    const result = serialize(minimalObj);
    expect(result).not.toContain("USER INPUTS");
  });

  test("includes USER INPUTS section when inputs provided", () => {
    const result = serialize({
      inputs: [minimalInput],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("USER INPUTS");
  });

  test("USER INPUTS appears before TO ACHIEVE", () => {
    const result = serialize({
      inputs: [minimalInput],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result.indexOf("USER INPUTS")).toBeLessThan(result.indexOf("TO ACHIEVE"));
  });

  test("TO ACHIEVE appears before RESULTS", () => {
    const result = serialize(minimalObj);
    expect(result.indexOf("TO ACHIEVE")).toBeLessThan(result.indexOf("RESULTS"));
  });

  test("sections separated by ---", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("---");
  });

  test("default separator is \\n\\n---\\n\\n", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("\n\n---\n\n");
  });

});

// ── section comments ──────────────────────────────────────────────────────────

describe("serialize — section comments", () => {

  test("USER INPUTS includes # comment", () => {
    const result = serialize({
      inputs: [minimalInput],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("# What the user passes in");
  });

  test("TO ACHIEVE includes # comment", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("# What to accomplish for the user");
  });

  test("RESULTS includes # comment", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("# What the user gets back");
  });

});

// ── section counts ────────────────────────────────────────────────────────────

describe("serialize — section counts", () => {

  test("inputs[N] count matches number of inputs", () => {
    const result = serialize({
      inputs: [minimalInput, { name: "documents", description: "docs" }],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("inputs[2]:");
  });

  test("goals[N] count matches number of goals", () => {
    const result = serialize({
      goals: [minimalGoal, { ...minimalGoal, name: "verify_answer" }],
      outputs: [minimalOutput]
    });
    expect(result).toContain("goals[2]:");
  });

  test("outputs[N] count matches number of outputs", () => {
    const result = serialize({
      goals: [minimalGoal],
      outputs: [minimalOutput, { name: "score", description: "confidence score" }]
    });
    expect(result).toContain("outputs[2]:");
  });

  test("single input produces inputs[1]", () => {
    const result = serialize({
      inputs: [minimalInput],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("inputs[1]:");
  });

  test("single goal produces goals[1]", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("goals[1]:");
  });

  test("single output produces outputs[1]", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("outputs[1]:");
  });

});

// ── options ───────────────────────────────────────────────────────────────────

describe("serialize — options", () => {

  test("uses default indent of two spaces", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("  # What to accomplish");
  });

  test("uses custom indent", () => {
    const result = serialize(minimalObj, { indent: "    " });
    expect(result).toContain("    # What to accomplish");
  });

  test("uses default separator", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("\n\n---\n\n");
  });

  test("uses custom separator", () => {
    const result = serialize(minimalObj, { sep: "\n---\n" });
    expect(result).toContain("\n---\n");
    expect(result).not.toContain("\n\n---\n\n");
  });

});

// ── single item inputs (non-array) ────────────────────────────────────────────

describe("serialize — single item inputs", () => {

  test("accepts single object as goals", () => {
    const result = serialize({ goals: minimalGoal, outputs: minimalOutput });
    expect(result).toContain("TO ACHIEVE");
    expect(result).toContain("goals[1]:");
  });

  test("accepts single object as outputs", () => {
    const result = serialize({ goals: [minimalGoal], outputs: minimalOutput });
    expect(result).toContain("RESULTS");
    expect(result).toContain("outputs[1]:");
  });

  test("accepts single object as inputs", () => {
    const result = serialize({
      inputs: minimalInput,
      goals: [minimalGoal],
      outputs: minimalOutput
    });
    expect(result).toContain("USER INPUTS");
    expect(result).toContain("inputs[1]:");
  });

});

// ── PPL output structure ──────────────────────────────────────────────────────

describe("serialize — PPL output structure", () => {

  test("full document contains all three sections in correct order", () => {
    const result = serialize({
      inputs: [minimalInput],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    const userIdx    = result.indexOf("USER INPUTS");
    const achieveIdx = result.indexOf("TO ACHIEVE");
    const resultsIdx = result.indexOf("RESULTS");
    expect(userIdx).toBeLessThan(achieveIdx);
    expect(achieveIdx).toBeLessThan(resultsIdx);
  });

  test("goal block name appears in output", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("@answer_from_kb");
  });

  test("output variable name appears in output", () => {
    const result = serialize(minimalObj);
    expect(result).toContain("$answer");
  });

  test("input variable name appears in output", () => {
    const result = serialize({
      inputs: [minimalInput],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    expect(result).toContain("$question");
  });

  test("goals list indented under goals[N]:", () => {
    const result = serialize(minimalObj);
    const goalsIdx = result.indexOf("goals[1]:");
    const goalBlockIdx = result.indexOf("GOAL @answer_from_kb");
    expect(goalsIdx).toBeLessThan(goalBlockIdx);
  });

  test("inputs list indented under inputs[N]:", () => {
    const result = serialize({
      inputs: [minimalInput],
      goals: [minimalGoal],
      outputs: [minimalOutput]
    });
    const inputsIdx = result.indexOf("inputs[1]:");
    const varIdx    = result.indexOf("$question");
    expect(inputsIdx).toBeLessThan(varIdx);
  });

  test("outputs list indented under outputs[N]:", () => {
    const result = serialize(minimalObj);
    const outputsIdx = result.indexOf("outputs[1]:");
    const varIdx     = result.indexOf("$answer");
    expect(outputsIdx).toBeLessThan(varIdx);
  });

  test("full RAG pipeline document", () => {
    const result = serialize({
      inputs: [
        { name: "question", description: "user question to answer", format: "text" },
        { name: "documents", description: "knowledge base documents", format: "json" }
      ],
      goals: [
        {
          name: "answer_from_kb",
          type: "GOAL",
          role: "research assistant",
          inputs: ["$question"],
          outputs: ["$answer"],
          steps: [
            { name: "search_kb", type: "STEP", do: ["retrieve top k documents"] },
            { name: "generate",  type: "STEP", do: ["synthesize answer"] }
          ]
        }
      ],
      outputs: [
        { name: "answer", description: "final verified answer", format: "markdown" }
      ]
    });

    expect(result).toContain("USER INPUTS");
    expect(result).toContain("TO ACHIEVE");
    expect(result).toContain("RESULTS");
    expect(result).toContain("inputs[2]:");
    expect(result).toContain("goals[1]:");
    expect(result).toContain("outputs[1]:");
    expect(result).toContain("$question");
    expect(result).toContain("$documents");
    expect(result).toContain("@answer_from_kb");
    expect(result).toContain("@search_kb");
    expect(result).toContain("@generate");
    expect(result).toContain("$answer");
    expect(result).toContain("---");
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