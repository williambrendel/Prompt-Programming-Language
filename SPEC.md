# PPL (Prompt Programming Language) Specification v2.0

> Pronounced: /ˈpip(ə)l/ like "people"
> Extension: `.ppl`
> MIME type: `text/x-ppl`

---

## 1. Overview

PPL (Prompt Programming Language) is a structured domain-specific language for writing LLM prompts.

It combines:

- declarative structure
- deterministic reasoning
- functional-style transformations
- pipeline orchestration

Design goals:

- Determinism
- Token efficiency
- Readability
- Static validation
- Composability
- Model portability

PPL separates:

- Logic → internal reasoning
- Flow → execution sequencing
- Structure → input/output contracts

### Example: Complete PPL Document

```
TASK
  Classify customer feedback as positive, neutral, or negative

---

ROLE
  Sentiment analyst
  tone=neutral

---

INPUT
  FORMAT: text
  SOURCE: user_query
  max_length=1000

---

FLOW
  $user_query |> classify_sentiment |> format_output

---

REASONING
  IF feedback CONTAINS "love|great|amazing" THEN sentiment=positive
  ELSE IF feedback CONTAINS "hate|bad|terrible" THEN sentiment=negative
  ELSE sentiment=neutral

---

OUTPUT
  FORMAT: json
  SCHEMA
    ```json
    { "sentiment": "string", "confidence": "number" }
    ```
```

---

## 2. Basic Syntax

- **Encoding:** UTF-8
- **Line endings:** LF (`\n`) or CRLF (`\r\n`)
- **Indentation:** 2 or 4 spaces (consistent). No tabs.
- **Empty lines:** Allowed anywhere, ignored by validator.
- **Section Separator:** `---` on its own line. Blank lines around it optional. Top-level sections MUST be separated by this. Cannot be first or last line.
- **Comments:** Start with `#`. Ignored by validator.

### Example: Basic Syntax

```
TASK
  Calculate total sales
  # This is a comment - ignored

---

ROLE
  Data analyst

---

INPUT
  FORMAT: csv
  SOURCE: sales_data
```

---

## 3. Sections

Sections are defined by `ALL_CAPS` headers at the start of a line. Top-level sections MUST be separated by `---`.

### 3.1 Required Sections

| Section | Required | Purpose |
|---------|----------|---------|
| `TASK` or `GOAL` | Yes (at least one) | Primary objective. |
| `ROLE` | Yes | The persona or identity the LLM should adopt. |
| `INPUT` | Yes | Defines the input data and its format. Must have a `FORMAT` subsection. |
| `OUTPUT` | Yes | Defines the expected output structure. Must have a `FORMAT` subsection. |

### Example: Required Sections

```
TASK
  Translate English to French

---

ROLE
  Professional translator
  style=formal

---

INPUT
  FORMAT: text
  SOURCE: user_query

---

OUTPUT
  FORMAT: text
  max_length=500
```

### 3.2 Recommended Sections

| Section | Recommended | Purpose |
|---------|-------------|---------|
| `REASONING` or `STEPS` or `ALGORITHM` | Highly Recommended | Logical process, decision trees, and algorithms. |
| `FLOW` | Recommended | Pipeline using `|>` operator. |

### Example: With Recommended Sections

```
TASK
  Answer customer question from knowledge base

---

ROLE
  Support agent

---

INPUT
  FORMAT: text

---

FLOW
  $question |> search_kb |> rank_results |> generate_answer

---

REASONING
  IF question CONTAINS "return policy" THEN search returns_doc
  ELSE IF question CONTAINS "shipping" THEN search shipping_doc
  ELSE search general_faq

---

OUTPUT
  FORMAT: markdown
```

### 3.3 Optional Sections

| Section | Purpose |
|---------|---------|
| `CONSTRAINTS` | Hard rules (e.g., "No external knowledge"). |
| `AUDIENCE` | Target audience for response. |
| `TONE` | Desired tone (e.g., "concise", "technical"). |
| `GROUNDING` | Source of truth (e.g., `provided_text_only`). |

### Example: With Optional Sections

```
TASK
  Explain quantum computing

---

ROLE
  Physics teacher

---

INPUT
  FORMAT: none

---

AUDIENCE
  10-year-old children

---

TONE
  playful, use analogies

---

CONSTRAINTS
  - No math equations
  - Max 200 words

---

GROUNDING
  provided_text_only

---

OUTPUT
  FORMAT: text
```

---

## 4. Subsections & Content

Indentation defines hierarchy.

- **Subsection Title:** `ALL_CAPS` on indented line.
  - *With inline value:* `FORMAT: json`
  - *Without inline value:* `FORMAT`
- **Variable:** `key=value` (e.g., `max_tokens=500`). No spaces around `=`.
- **Definition:** Starts with `@`, like `@varname: description`. Can be referred to in logic block later.
- **Lists:**
  - Unordered: `- item`
  - Ordered: `1. item`
- **Code Blocks:** Standard markdown triple backticks. Content inside not validated.

### Example: Subsections & Content

```
TASK
  Fetch API data

---

ROLE
  System Integrator

---

INPUT
  FORMAT: json
  SOURCE
    @api_endpoint: GET/POST/... endpoint for the api
    cache_ttl=3600
  VALIDATION
    - Required fields: id, name, price
    - Optional fields: description, tags
  SCHEMA
    ```json
    {
      "id": "string",
      "name": "string",
      "price": "number"
    }
    ```

---

OUTPUT
  FORMAT: json
```

---

## 5. Logic & Iteration Operators

These are strictly restricted to `REASONING`, `STEPS`, or `ALGORITHM` sections.

### 5.1 Comparison & Boolean

| Operator | Syntax | Description |
|----------|--------|-------------|
| **Equal** | `EQUAL` or `==` | Check for equality. |
| **Not Equal** | `NOT EQUAL` or `!=` or `<>` | Check for inequality. |
| **Logical NOT** | `NOT` or `!` | Negates a boolean. |
| **Logical AND** | `AND` or `&&` | Both conditions must be true. |
| **Logical OR** | `OR` or `||` | At least one condition must be true. |
| **Less Than** | `LESS THAN` or `LT` or `<` | First quantity less than second. |
| **Less Than or Equal** | `LESS THAN OR EQUAL` or `LTE` or `<=` | First ≤ second. |
| **Greater Than** | `GREATER THAN` or `GT` or `>` | First > second. |
| **Greater Than or Equal** | `GREATER THAN OR EQUAL` or `GTE` or `>=` | First ≥ second. |

### Example: Comparison & Boolean

```
REASONING
  IF score >= 90 THEN grade="A"
  ELSE IF score >= 80 AND score < 90 THEN grade="B"
  ELSE IF score >= 70 AND score < 80 THEN grade="C"
  ELSE grade="F"

  IF user_age < 18 AND NOT parental_consent THEN block_access=true
```

### 5.2 Bitwise Operators

| Operator | Syntax | Type | Description |
|----------|--------|------|-------------|
| **Bitwise NOT** | `~` | Unary | Inverts all bits. |
| **Bitwise AND** | `&` | Binary | 1 if both bits are 1. |
| **Bitwise OR** | `|` | Binary | 1 if at least one bit is 1. |
| **Bitwise XOR** | `^` | Binary | 1 if bits are different. |
| **Left Shift** | `<<` | Binary | Shifts bits left. |
| **Right Shift** | `>>` | Binary | Shifts right, preserves sign. |
| **Zero-Fill Right Shift** | `>>>` | Binary | Shifts right, fills zeros. |
| **Compound** | `…=` | Binary | `&=`, `|=`, `^=`, `<<=`, `>>=`, `>>>=` |

### Example: Bitwise Operators

```
REASONING
  permissions = READ | WRITE | EXECUTE
  IF (flags & EXECUTE) == EXECUTE THEN is_executable=true
  mask = ~WRITE
  clean_flags = flags & mask
```

### 5.3 Calculus Operators

| Operator | Syntax | Description |
|----------|--------|-------------|
| **Assignment** | `=` | Assign a variable. |
| **Addition** | `+` | Add two variables or scalars. |
| **Subtraction** | `-` | Subtract two variables or scalars. |
| **Multiplication** | `*` | Multiply two variables or scalars. |
| **Division** | `/` | Divide two variables or scalars. |
| **Iteration** | `++` or `--` | Increment or decrement. |
| **Compound** | `…=` | `+=`, `-=`, `*=`, `/=` |

### Example: Calculus Operators

```
REASONING
  total = 0
  FOR score IN scores
    total += score
  average = total / count
  counter++

  price_with_tax = base_price * 1.08
```

### 5.4 Logic & Iteration

| Operator | Syntax | Description |
|----------|--------|-------------|
| **Branch** | `IF...THEN...ELSE...FINALLY` | Conditional branching. |
| **State Loop** | `WHILE condition DO` | Repeat while true. |
| **Key Loop** | `FOR key IN object` | Iterate over object keys. |
| **Value Loop** | `FOR item OF list` | Iterate over list values. |
| **Item Loop** | `FOREACH item => logic` | Short for `FOR item OF list`. |
| **Transform** | `MAP list AS item => logic` | 1-to-1 mapping. |
| **Aggregate** | `REDUCE list AS item, acc => logic INITIAL val` | Many-to-1 accumulation. |

> **Note on REDUCE:** `AS` must be followed by two variables (item, accumulator). `INITIAL` is optional; defaults to `0`, `false`, `[]`, or `{}` depending on context.

### Example: Logic & Iteration

```
REASONING
  # Branching
  IF temperature > 100
  THEN status="boiling"
  ELSE IF temperature < 0
  THEN status="frozen"
  ELSE status="normal"

  # Value loop
  total = 0
  FOR price IN prices
    total += price

  # Key loop
  FOR key IN user_profile
    output += key + ": " + user_profile[key]

  # Transform (MAP)
  MAP prices AS p => p * 1.1

  # FOREACH shorthand
  FOREACH item => process(item)

  # Aggregate (REDUCE)
  REDUCE scores AS s, sum => sum + s INITIAL 0

  # Complex REDUCE
  REDUCE words AS w, longest => IF len(w) > len(longest) THEN w ELSE longest INITIAL ""
```

---

## 6. The FLOW Section

The `FLOW` section defines a high-level pipeline using the **Pipe Operator** `|>`.

- **Meaning:** `a |> b` means `a` then / feeds into `b`
- **Variables:** `$var` references data flowing through pipeline.
- **Constraint:** 
  - `|>` is strictly forbidden in logic blocks.
  - A flow always starts with at least one variable and ends with at least one variable


### Example: Basic Flow

```
FLOW
  $user_input |> validate |> sanitize |> summarize |> $output
```

### Example: Named Pipelines

```
FLOW
  default: $query |> embed |> search |> rank |> generate |> $output
  quick: $query |> cache_lookup |> generate |> $output
  fallback: $query |> rewrite |> search |> generate |> $output
```

### Example: Flow with Conditions

```
FLOW
  default: $query |> embed |> search |> rank |> generate |> $output
  fallback: $query |> rewrite |> search |> generate |> $output

---

REASONING
  IF results.count > 0 THEN FLOW=default
  ELSE FLOW=fallback
```

### Example: Real-World RAG Pipeline

```
TASK
  Answer user question using provided documents

---

ROLE
  RAG assistant

---

INPUT
  FORMAT: text
  query=$question
  documents=$docs

---

FLOW
  $question |> embed |> search_top_k($documents, k=5) |> rerank |> generate_answer |> verify_grounding |> $output

---

OUTPUT
  FORMAT: markdown
  GROUNDING: citations_required
```

### 6.1 Complete Flow Rules

The `FLOW` section enforces specific syntactic rules to ensure pipelines are valid and unambiguous.

#### 6.1.1 Core Rules

| Rule | Description | Example |
|------|-------------|---------|
| **Variables** | Flow must start and end with variables (`$variable`). Intermediate steps can be variables or words. | `$start \|> process \|> $end` |
| **Word Steps** | Intermediate words must contain only letters, numbers, hyphens, or underscores. | `$data \|> validate-input \|> transform_data \|> $output` |
| **Variable Steps** | Intermediate steps can also be variables for dynamic dispatch. | `$data \|> $validator \|> $transformer \|> $output` |
| **Surrounded Values** | The `\|>` operator must have non-empty values on both sides. | ✅ `$a \|> b \|> $c` ❌ `$a \|> \|> $c` |

#### 6.1.2 Multi-Flow Rules

A `FLOW` section can contain multiple pipeline definitions. They follow these rules:

| Scenario | Requirement | Example |
|----------|-------------|---------|
| **Single Flow** | No naming required | `$input \|> process \|> $output` |
| **Multiple Named Flows** | Each flow must have a unique name prefix (`name:`) | `primary: $a \|> b \|> $c`<br>`fallback: $a \|> d \|> $e` |
| **Compounding Chain** | Unnamed flows allowed if each flow's output variable matches the next flow's input variable | `$word1 \|> $word2`<br>`$word2 \|> $word3` |
| **Unrelated Multiple Flows** | Must be named (cannot be compounding chain) | ❌ `$a \|> b \|> $c`<br>`$d \|> e \|> $f`<br>✅ `flow1: $a \|> b \|> $c`<br>`flow2: $d \|> e \|> $f` |

#### 6.1.3 Compounding Chain Examples

A **compounding chain** is when flows are connected through shared variables:

```
# Valid: Compounding chain (no names needed)
FLOW
$user_input |> validate |> $validated
$validated |> enrich |> $enriched
$enriched |> format |> $output
```
This is treated as a **single logical pipeline** split across multiple lines for readability.

#### 6.1.4 Flow Operator Syntax

The **only** valid flow operator is `|>` (pipe). Any other arrow-like symbol is an **error**.

| Valid | Invalid (Error) |
|-------|-----------------|
| `\|>` | `->`, `=>`, `~>`, `>` |
|       | `>>`, `>>>` |
|       | `→`, `➔`, `➡︎`, `➠`, `➧` |
|       | `‣`, `▸`, `▶︎`, `▹`, `►` |

**Error Message:** `Invalid flow operator. Use |> (pipe operator) for flow pipelines.`

**Examples:**
```
# Invalid - will error
FLOW
$input -> process -> $output
```
```
# Valid
FLOW
$input |> process |> $output
```

#### 6.1.5 Invalid Flow Examples
```
# Invalid: Multiple unrelated flows without names
FLOW
$query |> search |> $results
$data |> validate |> $clean

# Error: "Multiple flows in FLOW section must be named..."
```

```
# Invalid: Flow operator without surrounding values
FLOW
$start |> |> $end

# Error: "Flow operators like |> must be surrounded by values"
```

```
# Invalid: Flow doesn't start or end with variable
FLOW
start |> process |> end

# Error: "Flow must start and end with variables (e.g., $start |> process |> $end)"
```

```
# Invalid: Invalid characters in step name
FLOW
$input |> process!data |> $output

# Error: 'Invalid flow step "process!data". Steps must be words (letters, numbers, hyphens, underscores) or variables starting with $'
```

```
# Invalid - will error
FLOW
$input -> process -> $output

# Error: "Invalid flow operator. Use |> (pipe operator) for flow pipelines."
```
#### 6.1.6 Flow Section Validation Summary

| What is validated | Valid | Invalid |
|-------------------|-------|---------|
| Single unnamed flow | ✅ `$a \|> b \|> $c` | - |
| Named flow | ✅ `name: $a \|> b \|> $c` | - |
| Compounding chain (unnamed) | ✅ `$a \|> $b`<br>`$b \|> $c` | - |
| Multiple unrelated flows | - | ❌ Must be named |
| Empty `\|>` segment | - | ❌ `$a \|> \|> $c` |
| Missing start/end variable | - | ❌ `a \|> b \|> c` |
| Invalid step characters | - | ❌ `$a \|> step! \|> $b` |
| `\|>` outside FLOW section | - | ❌ In REASONING/TASK |
| NOT `\|>`, like `-->` invalid flow operator | - | ❌ In FLOW |
| Duplicate flow names | - | ❌ Should be unique |
| Flow section with no flow | - | ❌ Name the section something else |
| Flow variables declared outside INPUT, OUTPUT or FLOW | - | ❌ Move the variable in INPUT, OUTPUT or FLOW |

---

## 7. Operator Scope Rules

| Operator Type | Appears | Sections |
|---------------|---------|----------|
| Comparison & Boolean | only | `REASONING`, `STEPS`, or `ALGORITHM` |
| Bitwise Operators | only | `REASONING`, `STEPS`, or `ALGORITHM` |
| Calculus Operators | mostly | `REASONING`, `STEPS`, or `ALGORITHM`* |
| Logic & Iteration Operators | only | `REASONING`, `STEPS`, or `ALGORITHM` |
| Flow Operators (`|>`) | only | `FLOW` |

*\*Except `-`, `*`, `/` which may appear in natural language formatting*

### Example: Scope Violation (Invalid)

```
FLOW
  IF score > 90 |> validate   # ERROR: IF not allowed in FLOW
  $data |> MAP x => x*2        # ERROR: MAP not allowed in FLOW
```

### Example: Scope Correct (Valid)

```
REASONING
  IF score > 90 THEN priority="high"   # OK

---

FLOW
  $data |> validate |> transform |> $output   # OK
```

---

## 8. Validation Rules

| Rule | Requirement | Violation |
|------|-------------|-----------|
| Operator Scope Rules | appears only in allowed sections | Error |
| Section Header | ALL_CAPS, no trailing colon | Error |
| Variable | `key=value`, no spaces around `=` | Warning |
| Separator | `---` alone on its own line between top sections | Error |
| Indentation | consistent (2 or 4 spaces) | Warning |
| Required Sections | `TASK`/`GOAL`, `ROLE`, `INPUT`, `OUTPUT` present | Error |
| `=>` usage | only in `MAP`/`REDUCE`/`FOREACH` | Error |
| Complete FLOW Rules | Respected | Error |
| `\|>` usage | only in `FLOW` section | Error |
| `$` usage  | starts and ends with at least one $variable | Error |

### Example: Validation Failures

```
task                     # ERROR: must be TASK (ALL_CAPS)
  Do something

---

ROLE
  Assistant

---

INPUT
  FORMAT=json            # WARNING: should be FORMAT: json or key=value?

---

OUTPUT
  FORMAT: text

---

REASONING
  FOREACH item -> process   # ERROR: use => not ->
```

### Example: Valid Document

```
TASK
  Validate user input

---

ROLE
  Validator

---

INPUT
  FORMAT: json

---

REASONING
  FOREACH field IN required_fields
    IF input[field] IS missing THEN error=true

---

OUTPUT
  FORMAT: json
```

---

## 9. Full End-to-End Examples

### Example 1: Sentiment Analysis with Scoring

```
TASK
  Analyze customer review sentiment and assign confidence score

---

ROLE
  Sentiment analyst
  style=quantitative

---

INPUT
  FORMAT: text
  SOURCE: user_query
  review=$text

---

FLOW
  $review |> tokenize |> analyze_sentiment |> score_confidence |> output

---

REASONING
  positive_words = ["love", "great", "amazing", "perfect"]
  negative_words = ["hate", "bad", "terrible", "awful"]

  positive_count = 0
  negative_count = 0

  FOR word IN split($review)
    IF word IN positive_words THEN positive_count++
    ELSE IF word IN negative_words THEN negative_count++

  net_score = positive_count - negative_count

  IF net_score > 2 THEN sentiment="positive" confidence=0.9
  ELSE IF net_score < -2 THEN sentiment="negative" confidence=0.9
  ELSE IF net_score > 0 THEN sentiment="positive" confidence=0.6
  ELSE IF net_score < 0 THEN sentiment="negative" confidence=0.6
  ELSE sentiment="neutral" confidence=0.8

---

OUTPUT
  FORMAT: json
  SCHEMA
    ```json
    {
      "sentiment": "string",
      "confidence": "number",
      "positive_score": "number",
      "negative_score": "number"
    }
    ```
```

### Example 2: Multi-Step RAG with Fallback

```
TASK
  Answer user question using knowledge base, fallback to web search if needed

---

ROLE
  Research assistant

---

INPUT
  FORMAT: text
  query=$question
  kb=$documents

---

FLOW
  default: $query |> embed |> search_kb(kb=$documents, k=3) |> check_relevance
  fallback: $query |> web_search |> scrape |> extract_answer

---

REASONING
  IF relevance_score >= 0.7
  THEN answer = generate_from_kb($results)
  ELSE answer = execute_flow("fallback")

---

OUTPUT
  FORMAT: markdown
  CITATIONS: required

---

CONSTRAINTS
  - If confidence < 0.6, state "I'm not certain"
  - Always cite sources
```

### Example 3: Data Processing Pipeline

```
TASK
  Process sales data: clean, aggregate, and generate report

---

ROLE
  Data analyst

---

INPUT
  FORMAT: csv
  SOURCE: sales_data.csv
  date_range=last_30_days

---

FLOW
  $raw_data |> validate |> clean |> aggregate |> format_report

---

REASONING
  MAP records AS r => r.price * r.quantity

  REDUCE totals AS t, sum => sum + t INITIAL 0

  average = total / count

  IF average > target THEN performance="above_expected"
  ELSE performance="needs_improvement"

---

OUTPUT
  FORMAT: markdown
  SECTIONS
    - total_sales
    - average_order_value
    - performance_rating
```

---

## 10. Template

```
TASK
  Your task

---

ROLE
  The persona performing the task

---

INPUT
  FORMAT: input format
  SCHEMA: input schema if not plain text or known schema like csv
  VALIDATION
  - Rules to validate the input, especially if the schema is provided, like required fields

...

---

FLOW
  Flow block describing how the task is achieved, starting from the input, like: input |> ... |> output

...

---

REASONING
  Reasoning block with reasoning operators. Subsections needed for each part of the FLOW, if FLOW is specified
  RULES
  - list of rules to ground the reasoning
  CONSTRAINTS
  - list of constraints like constraint_1=value

...

---

OUTPUT
  FORMAT: output format
  SCHEMA: output schema if not plain text or known schema like csv
  VALIDATION
  - Rules to validate the output, especially if the schema is provided, like required fields
```

---

## 11. File Extension & MIME Type

- **Extension:** `.ppl`
- **MIME type:** `text/x-ppl`

---

## 12. Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-04-03 | Added comprehensive examples throughout. Fixed typos. Finalized operator scope rules. Added @ syntax. Added template. Enforced --- between top sections. |

---

## 13. Copyright & License

### Copyright
Copyright (c) 2026 PPL Specification Authors. All rights reserved.

### License
Licensed under the **Apache License, Version 2.0** (the "License"); you may not use this file except in compliance with the License.