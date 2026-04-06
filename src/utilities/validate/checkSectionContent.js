"use strict";

const getLines = require("./getLines");

const SPECIAL_CHARS_RE = /^[^a-zA-Z0-9]+$/;

// Logic operators
const STRICT_LOGIC_RE = />>>?=?|<<=?|[<>!]=|==|<>|&&|\|\||(?:\^|&|~|\|[^>\s])|\b(LT|GT|LTE|GTE|EQUAL|NOT EQUAL)\b|(\bIF\b.*?\b(IS|CONTAINS|THEN|ELSE|AND|OR|NOT)\b)|(\bFOR\b.*?\b(IN|OF)\b)|(\b(MAP|REDUCE|FOREACH)\b.*?\bAS\b)/;
const CASE_INSENSITIVE_LOGIC_RE = new RegExp(STRICT_LOGIC_RE.source, "i");

// Flow operators
const FLOW_SYMBOL_RE = /\|>/;
const FLOW_VAR_RE = /\$[a-zA-Z_][a-zA-Z0-9_]*/;
const FLOW_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*:/;
const VALID_STEP_RE = /^[a-zA-Z0-9_-]+$/;
const NON_STANDARD_FLOW_RE = /(?:-{1,}>|={1,}>|~{1,}>|>>>?|→|➔|➡︎|➠|➧|‣|▸|▶|▶︎|▹|►|\s>\s)/;

// Variable registry for cross-section validation
class VariableRegistry {
  constructor() {
    this.variables = new Map(); // varName -> { definedIn: string, line: number, isInput: boolean, isOutput: boolean }
    this.references = new Map(); // varName -> Array of { usedIn: string, line: number }
  }
  
  /**
   * @function defineVariable
   * @description Registers a variable definition in a section
   * @param {string} name - Variable name (with $ prefix)
   * @param {string} section - Section name (INPUT, OUTPUT, FLOW)
   * @param {number} line - Line number where defined
   * @param {boolean} isInput - Whether this is an INPUT variable
   * @param {boolean} isOutput - Whether this is an OUTPUT variable
   * @returns {boolean} True if defined successfully, false if duplicate in different section
   */
  defineVariable(name, section, line, isInput = false, isOutput = false) {
    if (this.variables.has(name)) {
      const existing = this.variables.get(name);
      if (existing.definedIn !== section) {
        return false;
      }
    }
    this.variables.set(name, { definedIn: section, line, isInput, isOutput });
    return true;
  }
  
  /**
   * @function referenceVariable
   * @description Registers a variable reference in a section
   * @param {string} name - Variable name (with $ prefix)
   * @param {string} section - Section name (OUTPUT, FLOW)
   * @param {number} line - Line number where referenced
   */
  referenceVariable(name, section, line) {
    if (!this.references.has(name)) {
      this.references.set(name, []);
    }
    this.references.get(name).push({ usedIn: section, line });
  }
  
  /**
   * @function getUndefinedVariables
   * @description Returns all variables that are referenced but never defined
   * @returns {Array<{name: string, references: Array}>} Array of undefined variables with their references
   */
  getUndefinedVariables() {
    const undefined = [];
    for (const [name, refs] of this.references) {
      if (!this.variables.has(name)) {
        undefined.push({ name, references: refs });
      }
    }
    return undefined;
  }
  
  /**
   * @function getDuplicateDefinitions
   * @description Returns all variables that are defined multiple times
   * @returns {Array<{name: string, first: Object, second: Object}>} Array of duplicate definitions
   */
  getDuplicateDefinitions() {
    const duplicates = [];
    const seen = new Map();
    for (const [name, info] of this.variables) {
      if (seen.has(name)) {
        duplicates.push({ name, first: seen.get(name), second: info });
      } else {
        seen.set(name, info);
      }
    }
    return duplicates;
  }
}

const variableRegistry = new VariableRegistry();

/**
 * @function extractVariablesFromLine
 * @private
 * @description
 * Extracts all variable names from a line that match the pattern $variable: description
 *
 * @param {string} line - The line content to extract variables from
 * @returns {Array<string>} Array of variable names (with $ prefix)
 * 
 * @example
 * extractVariablesFromLine("  $input: user query")
 * // → ["$input"]
 * 
 * @example
 * extractVariablesFromLine("  $data: raw data  $output: result")
 * // → ["$data", "$output"]
 */
const extractVariablesFromLine = (line) => {
  const variables = [];
  const varPattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  let match;
  while ((match = varPattern.exec(line)) !== null) {
    variables.push('$' + match[1]);
  }
  return variables;
};

/**
 * @file checkSectionContent.js
 * @module ppl/utilities/validate/checkSectionContent
 * @description
 * Validates the semantic content within PPL document sections, focusing on:
 * - Logic operators in REASONING/STEPS/ALGORITHM sections
 * - Flow syntax in FLOW sections
 * - Variable definitions and references across sections
 *
 * This function performs deep content validation beyond structural checks,
 * ensuring that operators and flow syntax follow PPL language specifications.
 *
 * ## Validation Rules
 *
 * ### Logic Operators (REASONING/STEPS/ALGORITHM sections)
 * | Rule | Severity |
 * |------|----------|
 * | Operators must be uppercase (LT, GT, IF, THEN, ELSE, AND, OR, NOT, CONTAINS, FOR, IN, OF, MAP, REDUCE, FOREACH, AS) | Error |
 * | Operators cannot be used outside REASONING/STEPS/ALGORITHM sections | Error |
 *
 * ### Flow Syntax (FLOW section)
 * | Rule | Severity |
 * |------|----------|
 * | Flow operator `|>` must be surrounded by values | Error |
 * | Flow must start and end with variables (`$variable`) | Error |
 * | Multiple flows in same section must be named or form a compounding chain | Error |
 * | Intermediate steps must be words (letters, numbers, hyphens, underscores) or variables | Error |
 * | Flow operators cannot be used outside FLOW section | Error |
 *
 * ### Variable Rules
 * | Rule | Severity |
 * |------|----------|
 * | Variables can only appear in INPUT, OUTPUT, or FLOW sections | Error |
 * | Variables must be defined before use | Error |
 * | Variable names must be unique across sections | Error |
 *
 * ## Design Rationale
 *
 * - **Separation of Concerns**: Content validation is separated from structural validation
 *   (`checkSections.js`) to allow for more granular error reporting.
 * - **Case Sensitivity**: Logic operators are enforced as uppercase to maintain consistency
 *   across PPL documents and prevent ambiguity.
 * - **Flow Variables**: Requiring `$` prefix for flow variables distinguishes them from
 *   static text and enables variable tracking across the pipeline.
 * - **Compounding Flows**: Flows that share variables (output of one equals input of next)
 *   are considered a single logical flow and don't require naming.
 * - **Variable Registry**: Cross-section variable tracking ensures all variables are
 *   properly defined and used only in allowed sections.
 *
 * ## Stability Contract
 *
 * This module defines the semantic rules for PPL content. Changes to validation logic
 * will affect:
 * - All PPL documents containing REASONING/STEPS/ALGORITHM logic
 * - All FLOW section definitions
 * - Downstream variable resolution and flow execution
 *
 * @function checkSectionContent
 *
 * @param {string} content - Raw PPL document content to validate
 * @param {Array} [feedback=[]] - Reference array for collecting validation feedback
 *
 * @returns {Array} The updated feedback array with validation results
 *
 * @example
 * // Valid REASONING section with logic operators
 * const content = `
 * REASONING
 *   IF temperature IS GREATER THAN 100 THEN
 *     alert OVERHEATING
 *   END IF
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback.length === 0
 *
 * @example
 * // Invalid: lowercase logic operators
 * const content = `
 * REASONING
 *   if temperature > 100 then alert OVERHEATING
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback[0].message === "Comparison and logic operators have to be capitalized"
 *
 * @example
 * // Valid FLOW section with single flow
 * const content = `
 * FLOW
 *   $user_input |> validate |> $validated_data
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback.length === 0
 *
 * @example
 * // Valid: Multiple named flows
 * const content = `
 * FLOW
 *   auth: $credentials |> verify |> $user
 *   data: $user |> fetch_profile |> $profile
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback.length === 0
 *
 * @example
 * // Valid: Compounding flows (no names needed)
 * const content = `
 * FLOW
 *   $word1 |> $word2
 *   $word2 |> $word3
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback.length === 0 - flows are connected through shared variable
 *
 * @example
 * // Invalid: Multiple flows without names (not compounding)
 * const content = `
 * FLOW
 *   $start |> process1 |> $mid
 *   $different |> process2 |> $end
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback[0].message === "Multiple flows in FLOW section must be named..."
 *
 * @example
 * // Invalid: Flow without surrounding values
 * const content = `
 * FLOW
 *   $start |> |> $end
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback[0].message === "Flow operators like |> must be surrounded by values"
 *
 * @example
 * // Invalid: Flow not starting/ending with variables
 * const content = `
 * FLOW
 *   start |> process |> end
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback[0].message === "Flow must start and end with variables"
 *
 * @example
 * // Invalid: Flow operators outside FLOW section
 * const content = `
 * TASK
 *   $data |> process
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback[0].message === "Flow operators like |> must only be used under a FLOW section"
 * 
 * @example
 * // Invalid: Variable in TASK section
 * const content = `
 * TASK
 *   Process $user_input
 * `;
 * const feedback = checkSectionContent(content);
 * // feedback[0].message === 'Variable "$user_input" cannot be used in TASK section...'
 */
const checkSectionContent = (content, feedback) => {
  // Normalize input.
  feedback || (feedback = []);
  content || (content = "");

  // Reset variable registry for each document
  variableRegistry.variables.clear();
  variableRegistry.references.clear();

  // Get lines.
  const lines = getLines(content);

  // Store sections for processing
  const sections = [];
  const contentLines = [];
  let title;
  
  for (let i = 0, l = lines.length; i !== l; ++i) {
    let line = lines[i] || "", trimmed = line.trimStart();
    if (!trimmed) continue;

    const indentation = line.slice(0, line.length - trimmed.length) || "";
    line = trimmed.trimEnd();

    if (!line || line.charAt(0) === "#") continue;

    if (indentation) {
      contentLines.push({txt: line, line: i + 1});
    } else if (line.toUpperCase() === line) {
      if (!SPECIAL_CHARS_RE.test(line)) {
        if (title) {
          sections.push({
            title: title,
            contentLines: [...contentLines]
          });
        }
        title = {txt: line, line: i + 1};
        contentLines.length = 0;
      }
    } else {
      contentLines.push({txt: line, line: i + 1});
    }
  }
  
  if (title) {
    sections.push({
      title: title,
      contentLines: [...contentLines]
    });
  }
  
  // Process each section (collect variables and validate)
  for (const section of sections) {
    const titleText = section.title.txt;
    
    // Extract and register variables from this section
    for (const lineObj of section.contentLines) {
      const line = lineObj.txt;
      const lineNum = lineObj.line;
      const variables = extractVariablesFromLine(line);
      
      for (const varName of variables) {
        if (titleText === "INPUT") {
          variableRegistry.defineVariable(varName, "INPUT", lineNum, true, false);
        } else if (titleText === "OUTPUT") {
          variableRegistry.referenceVariable(varName, "OUTPUT", lineNum);
        } else if (titleText === "FLOW") {
          // For FLOW, variables will be registered in validateFlowSyntax
          // Skip here to avoid duplication
        } else {
          // Variable in wrong section - error
          feedback.push({
            type: "error",
            message: `Variable "${varName}" cannot be used in ${titleText} section. Variables are only allowed in INPUT, OUTPUT, and FLOW sections.`,
            line: lineNum
          });
        }
      }
    }
    
    // Now validate the section content
    sectionAnalysis(section.title, section.contentLines, feedback, variableRegistry);
  }
  
  // After all sections, check for undefined variables
  const undefinedVars = variableRegistry.getUndefinedVariables();
  for (const { name, references } of undefinedVars) {
    for (const ref of references) {
      feedback.push({
        type: "error",
        message: `Undefined variable "${name}". Variables must be defined in INPUT section or as output of a previous flow.`,
        line: ref.line
      });
    }
  }
  
  // Check for duplicate variable definitions
  const duplicates = variableRegistry.getDuplicateDefinitions();
  for (const { name, first, second } of duplicates) {
    feedback.push({
      type: "error",
      message: `Variable "${name}" is already defined in ${first.definedIn} section at line ${first.line}. Duplicate definition in ${second.definedIn} section at line ${second.line}.`,
      line: second.line
    });
  }

  return feedback;
}

/**
 * @function sectionAnalysis
 * @private
 * @description
 * Analyzes a single section's content for semantic errors based on section type.
 *
 * This function coordinates validation for different section types:
 * - REASONING/STEPS/ALGORITHM: Validates logic operator case sensitivity
 * - FLOW: Validates flow syntax structure
 * - Other sections: Ensures flow operators are not used
 *
 * @param {Object} title - The section title object with txt and line properties
 * @param {Array<Object>} contentLines - Array of content line objects
 * @param {Object} contentLines[].txt - The line text content
 * @param {number} contentLines[].line - The original line number
 * @param {Array} feedback - Reference array for collecting validation feedback
 * @param {VariableRegistry} variableRegistry - Registry for tracking variables across sections
 *
 * @returns {Array} The updated feedback array
 *
 * @example
 * // Validating a REASONING section with uppercase operators
 * const contentLines = [
 *   { txt: "  IF x IS GREATER THAN y THEN", line: 2 },
 *   { txt: "    alert DIFFERENCE", line: 3 },
 *   { txt: "  END IF", line: 4 }
 * ];
 * sectionAnalysis({txt: "REASONING", line: 1}, contentLines, feedback, variableRegistry);
 *
 * @example
 * // Validating a FLOW section
 * const contentLines = [
 *   { txt: "  $input |> validate |> $output", line: 2 }
 * ];
 * sectionAnalysis({txt: "FLOW", line: 1}, contentLines, feedback, variableRegistry);
 *
 * @example
 * // Error: Flow operator outside FLOW section
 * const contentLines = [
 *   { txt: "  $data |> process", line: 2 }
 * ];
 * sectionAnalysis({txt: "TASK", line: 1}, contentLines, feedback, variableRegistry);
 * // Pushes error: "Flow operators like |> must only be used under a FLOW section"
 */
const sectionAnalysis = (title, contentLines, feedback, variableRegistry) => {
  let titleText = title.txt;
  let titleLine = title.line;
  
  (titleText === "STEPS" || titleText === "ALGORITHM") && (titleText = "REASONING");

  // Extract content and content line range.
  let content = contentLines.map(({ txt }) => txt).join("\n"),
    lineRange = contentLines.length && [contentLines[0].line, contentLines[contentLines.length - 1].line] || [titleLine, titleLine];
  
  if (lineRange) {
    lineRange[1] <= lineRange[0] && (lineRange.length = 1);
    isNaN(lineRange[0]) && (lineRange[0] = null);
    lineRange = lineRange.length > 1 ? lineRange : lineRange[0];
  } else {
    lineRange = null;
  }

  // Detect logic semantic errors.
  titleText === "REASONING" && CASE_INSENSITIVE_LOGIC_RE.test(content) && !STRICT_LOGIC_RE.test(content)
    && feedback.push({ type: "error", message: `Comparison and logic operators have to be capitalized`, line: lineRange })
    || (
      titleText !== "REASONING" && STRICT_LOGIC_RE.test(content)
        && feedback.push({ type: "error", message: `Comparison and logic operators can only be used inside a REASONING, STEPS, or ALGORITHM section`, line: lineRange })
    );

  // Detect flow semantic error.
  if (titleText === "FLOW") {
    validateFlowSyntax(content, contentLines, lineRange, feedback, variableRegistry);
  } else {
    FLOW_SYMBOL_RE.test(content)
      && feedback.push({ type: "error", message: `Flow operators like |> must only be used under a FLOW section`, line: lineRange });
  }

  return feedback;
}

/**
 * @function validateFlowSyntax
 * @private
 * @description
 * Validates the syntax of all flows within a FLOW section.
 *
 * This function parses multiple flows from content lines, checking for:
 * - Proper `|>` operator usage (surrounded by values)
 * - Named flows when multiple flows exist (unless they form a compounding chain)
 * - Individual flow structure (start/end with variables, valid steps)
 *
 * @param {string} content - The full section content as a single string
 * @param {Array<Object>} contentLines - Array of content line objects with line numbers
 * @param {number|Array<number>|null} lineRange - Line range(s) for error reporting
 * @param {Array} feedback - Reference array for collecting validation feedback
 * @param {VariableRegistry} variableRegistry - Registry for tracking variables across sections
 *
 * @returns {void}
 *
 * @example
 * // Single valid flow
 * const content = "$input |> validate |> $output";
 * const contentLines = [{ txt: "$input |> validate |> $output", line: 2 }];
 * validateFlowSyntax(content, contentLines, 2, feedback, variableRegistry);
 *
 * @example
 * // Multiple named flows
 * const content = "auth: $creds |> verify |> $user\ndata: $user |> fetch |> $profile";
 * const contentLines = [
 *   { txt: "auth: $creds |> verify |> $user", line: 2 },
 *   { txt: "data: $user |> fetch |> $profile", line: 3 }
 * ];
 * validateFlowSyntax(content, contentLines, [2,3], feedback, variableRegistry);
 *
 * @example
 * // Valid compounding flows (no names needed)
 * const content = "$word1 |> $word2\n$word2 |> $word3";
 * const contentLines = [
 *   { txt: "$word1 |> $word2", line: 2 },
 *   { txt: "$word2 |> $word3", line: 3 }
 * ];
 * validateFlowSyntax(content, contentLines, [2,3], feedback, variableRegistry);
 * // No error - flows form a compounding chain
 *
 * @example
 * // Error: Multiple flows without names (not compounding)
 * const content = "$start |> step1 |> $mid\n$different |> step2 |> $end";
 * const contentLines = [
 *   { txt: "$start |> step1 |> $mid", line: 2 },
 *   { txt: "$different |> step2 |> $end", line: 3 }
 * ];
 * validateFlowSyntax(content, contentLines, [2,3], feedback, variableRegistry);
 * // Pushes error: "Multiple flows in FLOW section must be named..."
 *
 * @example
 * // Error: Flow operator without surrounding values
 * const content = "$start |> |> $end";
 * const contentLines = [{ txt: "$start |> |> $end", line: 2 }];
 * validateFlowSyntax(content, contentLines, 2, feedback, variableRegistry);
 * // Pushes error: "Flow operators like |> must be surrounded by values"
 */
const validateFlowSyntax = (content, contentLines, lineRange, feedback, variableRegistry) => {
  // Check for empty segments between |> operators
  const parts = content.split(FLOW_SYMBOL_RE);
  const hasEmptySegment = parts.some(p => p.trim() === "");
  
  if (hasEmptySegment) {
    feedback.push({ 
      type: "error", 
      message: `Flow operators like |> must be surrounded by actions or flow variables like $input, $output`, 
      line: lineRange 
    });
  }

  // Check for non-standard flow operators (->, =>, →, etc.)
  if (NON_STANDARD_FLOW_RE.test(content) && !FLOW_SYMBOL_RE.test(content)) {
    const matched = content.match(NON_STANDARD_FLOW_RE)[0];
    feedback.push({
      type: "error",
      message: `Invalid flow operator "${matched}". Use |> (pipe operator) for flow pipelines.`,
      line: lineRange
    });
    return;
  }

  // Parse flows from contentLines
  // Multi-line flows: lines that start with |> are continuations
  // New flows: lines that start with $variable (or have a name prefix)
  const flows = [];
  let currentFlow = null;
  
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i].txt;
    const lineNum = contentLines[i].line;
    const trimmedLine = line.trim();
    
    if (FLOW_SYMBOL_RE.test(line)) {
      // Check if this line starts with |> (continuation) or with a variable (new flow)
      const startsWithPipe = trimmedLine.startsWith('|>');
      const startsWithVariable = FLOW_VAR_RE.test(trimmedLine);
      const hasNamePrefix = FLOW_NAME_RE.test(trimmedLine);
      
      if (currentFlow === null) {
        // Start a new flow
        currentFlow = { parts: [line], lines: [lineNum] };
      } else if (startsWithPipe) {
        // Continuation of current flow (multi-line)
        currentFlow.parts.push(line);
        currentFlow.lines.push(lineNum);
      } else if (startsWithVariable || hasNamePrefix) {
        // New flow starts (either with $variable or name: prefix)
        flows.push(currentFlow);
        currentFlow = { parts: [line], lines: [lineNum] };
      } else {
        // Line with |> but doesn't start with |> or variable - treat as continuation
        currentFlow.parts.push(line);
        currentFlow.lines.push(lineNum);
      }
    } else if (line.trim() && currentFlow !== null) {
      // Non-empty line without operator - end of current flow
      flows.push(currentFlow);
      currentFlow = null;
    }
  }
  
  // Push the last flow if it exists
  if (currentFlow !== null) {
    flows.push(currentFlow);
  }
  
  // Validation: Empty flow section (no flows defined)
  if (flows.length === 0 && lineRange !== null && lineRange !== undefined) {
    feedback.push({
      type: "error",
      message: `FLOW section contains no valid flow definitions. Each flow must contain the |> operator.`,
      line: lineRange
    });
    return;
  }
  
  // Validation: Flow name uniqueness
  const usedNames = new Set();
  for (const flow of flows) {
    const nameMatch = flow.parts[0].trim().match(FLOW_NAME_RE);
    if (nameMatch) {
      const name = nameMatch[0].slice(0, -1); // Remove trailing colon
      if (usedNames.has(name)) {
        feedback.push({
          type: "error",
          message: `Duplicate flow name "${name}". Flow names must be unique within a FLOW section.`,
          line: flow.lines[0]
        });
      }
      usedNames.add(name);
    }
  }
  
  // Track variables in flows
  for (const flow of flows) {
    const fullFlow = flow.parts.map(p => p.trim()).join(" ");
    const flowParts = fullFlow.split(FLOW_SYMBOL_RE).map(p => p.trim());
    
    // Register input variables (first part, after removing name prefix)
    const firstPart = flowParts[0].replace(FLOW_NAME_RE, "").trim();
    const inputMatch = firstPart.match(FLOW_VAR_RE);
    if (inputMatch) {
      variableRegistry.referenceVariable(inputMatch[0], "FLOW", flow.lines[0]);
    }
    
    // Register output variables (last part)
    const lastPart = flowParts[flowParts.length - 1].trim();
    const outputMatch = lastPart.match(FLOW_VAR_RE);
    if (outputMatch) {
      variableRegistry.defineVariable(outputMatch[0], "FLOW", flow.lines[flow.lines.length - 1], false, true);
    }
    
    // Register intermediate variables (steps that are variables)
    for (let i = 1; i < flowParts.length - 1; i++) {
      const stepMatch = flowParts[i].match(FLOW_VAR_RE);
      if (stepMatch) {
        variableRegistry.referenceVariable(stepMatch[0], "FLOW", flow.lines[0]);
      }
    }
  }
  
  // Validation: Compounding chain
  if (flows.length > 1) {
    const flowData = flows.map(flow => {
      const fullFlow = flow.parts.map(p => p.trim()).join(" ");
      const flowParts = fullFlow.split(FLOW_SYMBOL_RE).map(p => p.trim());
      const firstPart = flowParts[0].replace(FLOW_NAME_RE, "").trim();
      const lastPart = flowParts[flowParts.length - 1].trim();
      const isNamed = FLOW_NAME_RE.test(flow.parts[0]);
      
      const firstVarMatch = firstPart.match(FLOW_VAR_RE);
      const lastVarMatch = lastPart.match(FLOW_VAR_RE);
      
      return {
        flow,
        isNamed,
        input: firstVarMatch ? firstVarMatch[0] : firstPart,
        output: lastVarMatch ? lastVarMatch[0] : lastPart
      };
    });
    
    let isValidChain = true;
    let previousOutput = null;
    
    for (let i = 0; i < flowData.length; i++) {
      const current = flowData[i];
      
      if (!current.isNamed) {
        // For unnamed flows, check if they connect to previous output
        if (previousOutput !== null && current.input !== previousOutput) {
          isValidChain = false;
          break;
        }
      }
      
      // Update previous output regardless of named status
      // (named flows can be in the middle of a chain)
      previousOutput = current.output;
    }
    
    // If not a valid chain, report error
    if (!isValidChain) {
      const unnamedFlowsList = flowData.filter(f => !f.isNamed);
      if (unnamedFlowsList.length > 0) {
        feedback.push({
          type: "error",
          message: `Multiple flows in FLOW section must be named (e.g., "name: $start |> process |> $end") unless they form a single compounding chain where each flow's output variable matches the next flow's input variable`,
          line: lineRange
        });
      }
    }
  }
  
  // Validate each flow's internal structure
  for (const flow of flows) {
    validateSingleFlow(flow, feedback);
  }
}

/**
 * @function validateSingleFlow
 * @private
 * @description
 * Validates the structure of a single flow expression.
 *
 * This function performs detailed validation on an individual flow:
 * - Ensures flow starts and ends with variables (`$variable`)
 * - Validates intermediate steps are properly formatted
 * - Removes flow name prefixes before validation
 *
 * @param {Object} flow - The flow object containing parts and line numbers
 * @param {Array<string>} flow.parts - Array of line strings that make up the flow
 * @param {Array<number>} flow.lines - Array of original line numbers for each part
 * @param {Array} feedback - Reference array for collecting validation feedback
 *
 * @returns {void}
 *
 * @example
 * // Valid flow with word steps
 * const flow = {
 *   parts: ["$input |> validate |> sanitize |> $output"],
 *   lines: [2]
 * };
 * validateSingleFlow(flow, feedback);
 *
 * @example
 * // Valid flow with variable steps
 * const flow = {
 *   parts: ["$input |> $validator |> $sanitizer |> $output"],
 *   lines: [2]
 * };
 * validateSingleFlow(flow, feedback);
 *
 * @example
 * // Valid flow with hyphens and underscores in steps
 * const flow = {
 *   parts: ["$input |> validate-input |> sanitize_output |> $output"],
 *   lines: [2]
 * };
 * validateSingleFlow(flow, feedback);
 *
 * @example
 * // Valid named flow
 * const flow = {
 *   parts: ["auth: $creds |> verify |> $user"],
 *   lines: [2]
 * };
 * validateSingleFlow(flow, feedback);
 * // The "auth: " prefix is automatically stripped
 *
 * @example
 * // Error: Flow doesn't start with variable
 * const flow = {
 *   parts: ["input |> process |> $output"],
 *   lines: [2]
 * };
 * validateSingleFlow(flow, feedback);
 * // Pushes error: "Flow must start and end with variables"
 *
 * @example
 * // Error: Invalid step contains spaces or special chars
 * const flow = {
 *   parts: ["$input |> invalid step! |> $output"],
 *   lines: [2]
 * };
 * validateSingleFlow(flow, feedback);
 * // Pushes error: 'Invalid flow step "invalid step!". Steps must be words...'
 *
 * @example
 * // Multi-line flow
 * const flow = {
 *   parts: ["$input |> validate", "|> sanitize |> $output"],
 *   lines: [2, 3]
 * };
 * validateSingleFlow(flow, feedback);
 * // Parts are joined: "$input |> validate |> sanitize |> $output"
 */
const validateSingleFlow = (flow, feedback) => {
  // Combine all parts and split by |>
  const fullFlow = flow.parts.join(" ");
  const parts = fullFlow.split(FLOW_SYMBOL_RE).map(p => p.trim());
  
  // Remove any flow name prefix (e.g., "name: ")
  const firstPart = parts[0].replace(FLOW_NAME_RE, "").trim();
  parts[0] = firstPart;
  
  // Check first and last parts are variables (start with $)
  const firstIsVar = FLOW_VAR_RE.test(parts[0]);
  const lastIsVar = FLOW_VAR_RE.test(parts[parts.length - 1]);
  
  if (!firstIsVar || !lastIsVar) {
    feedback.push({
      type: "error",
      message: `Flow must start and end with variables (e.g., $start |> process |> $end)`,
      line: flow.lines
    });
  }
  
  // Validate intermediate steps
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    // Allow words (with letters, numbers, hyphens, underscores) or variables
    const isValidPart = VALID_STEP_RE.test(part) || FLOW_VAR_RE.test(part);
    if (!isValidPart && part !== "") {
      feedback.push({
        type: "error",
        message: `Invalid flow step "${part}". Steps must be words (letters, numbers, hyphens, underscores) or variables starting with $`,
        line: flow.lines
      });
    }
  }
}

/**
 * @ignore
 * Default export with freezing.
 */
checkSectionContent.sectionAnalysis = sectionAnalysis;
checkSectionContent.validateFlowSyntax = validateFlowSyntax;
checkSectionContent.validateSingleFlow = validateSingleFlow;
module.exports = Object.freeze(Object.defineProperty(checkSectionContent, "checkSectionContent", {
  value: checkSectionContent
}));