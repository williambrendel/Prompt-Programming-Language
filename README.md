# PPL - Prompt Programming Language

> Pronounced /ˈpip(ə)l/ like "people"

**PPL** is a structured domain-specific language for writing LLM prompts that are deterministic, token-efficient, and resistant to hallucinations.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0-green)](SPEC.md)

---

## The Problem

Prompts today are unstructured English. LLMs guess.

- You ask for JSON → you get markdown with "Here is your JSON:"
- You say "don't hallucinate" → the LLM still adds fake facts
- You want step-by-step reasoning → the LLM skips to the answer

**PPL fixes this.**

---

## The Differentiator

| What exists | PPL |
|-------------|-----|
| Natural language prompts | Structured DSL |
| LLM decides output format | You define FORMAT and schema |
| LLM decides reasoning path | You write IF/THEN/ELSE and loops |
| Hallucination managed post-hoc | GROUNDING prevents it at source |
| Pipelines are implicit | FLOW with |> makes them explicit |

**PPL is not a prompt template engine. It is a programming language for prompt logic.**

---

## Quick Example

Unstructured prompt:
```
"Tell me if this contract clause is risky: Payment due 30 days after delivery, but buyer can delay approval indefinitely."
```

PPL version:

```
TASK
  Analyze contract clause for risk level

---

ROLE
  Legal risk analyst
  
---

INPUT
  FORMAT: text
  $clause: input, a contract clause
  EXAMPLE: "Payment due 30 days after delivery, but buyer can delay approval indefinitely."
  
---

REASONING
  IF $clause CONTAINS "unlimited delay" THEN risk=high
  ELSE IF $clause CONTAINS "net 90" THEN risk=medium
  ELSE risk=low

  RULES
  - No hallucination
  
---

OUTPUT
  FORMAT: json
  SCHEMA
    ```json
      { "risk": "string", "reason": "string" }
    ```
  VALIDATION:
  - No extra text
  - fully json parsable
```

---

## Syntax at a Glance
```
TASK
  Do something

---

ROLE
  Expert
  tone=formal

---

INPUT
  FORMAT: json
  SOURCE
    - field1
    - field2

---

FLOW
  $input |> validate |> transform |> $output

---

REASONING
  IF score > 90 THEN grade="A"
  ELSE grade="B"
  FOREACH item => process(item)
  MAP prices AS p => p * 1.1
  REDUCE scores AS s, sum => sum + s INITIAL 0

---

OUTPUT
  FORMAT: markdown
```

---

## Installation

npm install -g prompt-programming-language

Or clone:

git clone https://github.com/williambrendel/Prompt-Programming-Language.git
cd Prompt-Programming-Language
npm install

---

## CLI Usage

ppl validate prompt.ppl
ppl refine "explain quantum computing to a 5-year-old"
ppl run prompt.ppl --model gpt-4

---

## Core Sections

TASK / GOAL - Required. Primary objective. One sentence.
ROLE - Required. Persona for the LLM.
INPUT - Required. Data and format specification.
OUTPUT - Required. Expected structure and schema.
REASONING - Recommended. Logic with IF/THEN/ELSE, FOR, MAP, REDUCE.
FLOW - Recommended. Pipeline with |> operator.
CONSTRAINTS - Optional. Hard rules.
GROUNDING - Optional. Source of truth.

---

## Logic Operators (for REASONING)

IF...THEN...ELSE - Conditional branching
FOR...IN - Iterate over collection
FOREACH item => - Shorthand iteration
MAP list AS x => - Transform each element
REDUCE list AS x, acc => - Aggregate with accumulator
WHILE - Loop while condition true

---

## Flow Pipelines (FLOW)

Use |> to chain operations:

```
FLOW
  $query |> embed |> search_kb |> rerank |> generate |> validate |> $output
```

Named pipelines:

```
FLOW
  default: $input |> validate |> process |> $output
  fallback: $input |> cache_lookup |> generate |> $output
```

---

## Editor Support

VS Code Extension: Syntax highlighting for .ppl files (coming soon)
IntelliJ Plugin: (planned)

---

## Examples

See the examples/ directory:
- sentiment_analysis.ppl
- rag_pipeline.ppl
- data_processing.ppl
- contract_risk.ppl

---

## Full Specification

See SPEC.md for the complete language specification.

---

## Roadmap

- [x] Language specification v2.0
- [x] Validator (JavaScript)
- [ ] Refiner (unstructured to PPL)
- [ ] VS Code extension
- [ ] LLM runners (OpenAI, Anthropic, local)
- [ ] PPL-to-English decompiler

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Submit a PR
Original Author: William Brendel

---

## Copyright & License

### Copyright
Copyright (c) 2026 PPL Specification Authors. All rights reserved.

### License
Licensed under the **Apache License, Version 2.0** (the "License"); you may not use this file except in compliance with the License.

---

**PPL - Write prompts like code.**