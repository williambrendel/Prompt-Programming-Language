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
  
  referenceVariable(name, section, line) {
    if (!this.references.has(name)) {
      this.references.set(name, []);
    }
    this.references.get(name).push({ usedIn: section, line });
  }
  
  getUndefinedVariables() {
    const undefined = [];
    for (const [name, refs] of this.references) {
      if (!this.variables.has(name)) {
        undefined.push({ name, references: refs });
      }
    }
    return undefined;
  }
  
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
    const contentStr = section.contentLines.map(({ txt }) => txt).join("\n");
    
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
 * @param {Object} title - The section title object with txt and line properties
 * @param {Array<Object>} contentLines - Array of content line objects
 * @param {Array} feedback - Reference array for collecting validation feedback
 * @param {VariableRegistry} variableRegistry - Registry for tracking variables across sections
 *
 * @returns {Array} The updated feedback array
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
  const flows = [];
  let currentFlow = null;
  
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i].txt;
    const lineNum = contentLines[i].line;
    const trimmedLine = line.trim();
    
    if (FLOW_SYMBOL_RE.test(line)) {
      const startsWithPipe = trimmedLine.startsWith('|>');
      const startsWithVariable = FLOW_VAR_RE.test(trimmedLine);
      const hasNamePrefix = FLOW_NAME_RE.test(trimmedLine);
      
      if (currentFlow === null) {
        currentFlow = { parts: [line], lines: [lineNum] };
      } else if (startsWithPipe) {
        currentFlow.parts.push(line);
        currentFlow.lines.push(lineNum);
      } else if (startsWithVariable || hasNamePrefix) {
        flows.push(currentFlow);
        currentFlow = { parts: [line], lines: [lineNum] };
      } else {
        currentFlow.parts.push(line);
        currentFlow.lines.push(lineNum);
      }
    } else if (line.trim() && currentFlow !== null) {
      flows.push(currentFlow);
      currentFlow = null;
    }
  }
  
  if (currentFlow !== null) {
    flows.push(currentFlow);
  }
  
  // Validation: Empty flow section
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
      const name = nameMatch[0].slice(0, -1);
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
    
    const firstPart = flowParts[0].replace(FLOW_NAME_RE, "").trim();
    const inputMatch = firstPart.match(FLOW_VAR_RE);
    if (inputMatch) {
      variableRegistry.referenceVariable(inputMatch[0], "FLOW", flow.lines[0]);
    }
    
    const lastPart = flowParts[flowParts.length - 1].trim();
    const outputMatch = lastPart.match(FLOW_VAR_RE);
    if (outputMatch) {
      variableRegistry.defineVariable(outputMatch[0], "FLOW", flow.lines[flow.lines.length - 1], false, true);
    }
    
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
        if (previousOutput !== null && current.input !== previousOutput) {
          isValidChain = false;
          break;
        }
      }
      previousOutput = current.output;
    }
    
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
 */
const validateSingleFlow = (flow, feedback) => {
  const fullFlow = flow.parts.join(" ");
  const parts = fullFlow.split(FLOW_SYMBOL_RE).map(p => p.trim());
  
  const firstPart = parts[0].replace(FLOW_NAME_RE, "").trim();
  parts[0] = firstPart;
  
  const firstIsVar = FLOW_VAR_RE.test(parts[0]);
  const lastIsVar = FLOW_VAR_RE.test(parts[parts.length - 1]);
  
  if (!firstIsVar || !lastIsVar) {
    feedback.push({
      type: "error",
      message: `Flow must start and end with variables (e.g., $start |> process |> $end)`,
      line: flow.lines
    });
  }
  
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
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
checkSectionContent.extractVariablesFromLine = extractVariablesFromLine;
module.exports = Object.freeze(Object.defineProperty(checkSectionContent, "checkSectionContent", {
  value: checkSectionContent
}));