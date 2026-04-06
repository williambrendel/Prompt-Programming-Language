const getLines = require("./getLines")

const SEP_RE = /^\-\-\-+$/;
const SPECIAL_CHARS_RE = /^[^a-zA-Z0-9]+$/;

/**
 * @file checkSections.js
 * @module ppl/utilities/validate/checkSections
 * @description
 * Validates the macro-structural organization of a document based on uppercase 
 * section headers and dashed separators.
 *
 * This function ensures that the document follows a strict "Separator-Header-Separator" 
 * pattern and contains specific mandatory sections required for the PPL pipeline.
 * It also prevents trailing separators and empty sections.
 *
 * ## Validation rules
 *
 * | Category       | Rule                                           | Severity |
 * |----------------|------------------------------------------------|----------|
 * | Separators     | Must match `---...-` exactly (no other symbols)| Error    |
 * | Separators     | Must be consistent (matching length)           | Warning  |
 * | Sequencing     | Headers must be preceded/followed by separators| Error    |
 * | Uniqueness     | Section titles cannot be duplicated            | Error    |
 * | Content        | Sections must contain at least one line        | Error    |
 * | Required       | Must contain ROLE, INPUT, OUTPUT, and TASK/GOAL| Error    |
 * | Termination    | Content cannot end with a separator            | Error    |
 * | Case/Format    | Non-indented lines must be Uppercase           | Warning  |
 *
 * ## Design rationale
 *
 * - **State Machine Logic**: Tracks the relationship between `lastTitle`, 
 * `isSep`, and `hasSectionContent` to enforce a strictly alternating structure.
 * - **Set-based Tracking**: Utilizes a `Set` for `titles` to provide O(1) 
 * lookup for duplicate detection and final verification of required sections.
 * - **Content Validation**: The `hasSectionContent` flag ensures that a 
 * section header isn't immediately followed by another separator or header.
 *
 * ## Stability contract
 *
 * This utility defines the "Template Schema" for document ingestion. Adding 
 * required sections here will immediately enforce them across all documents 
 * processed by the PPL engine.
 *
 * @function checkSections
 *
 * @param {string} content
 * The raw string content to be analyzed.
 *
 * @param {Array} [feedback=[]]
 * Reference array to collect error and warning objects.
 *
 * @returns {Array}
 * The updated feedback array containing found structural issues.
 *
 * @example
 * const feedback = checkSections(rawText);
 * if (feedback.some(f => f.type === "error")) {
 * console.error("Structural validation failed.");
 * }
 */
const checkSections = (content, feedback) => {
  // Normalize input.
  feedback || (feedback = []);
  content || (content = "");

  // Get lines.
  const lines = getLines(content);

  // titles.
  const titles = new Set;
  
  // Check macro sections and separators.
  let lastTitle, sep, isSep, isLastSep, j, hasSectionContent;
  for (let i = 0, l = lines.length; i !== l; ++i) {
    const line = lines[i] || "", trimmed = line.trimStart();
    if (!trimmed) continue; // blank line

    const indentation = line.slice(0, line.length - trimmed.length) || "",
      title = trimmed.trimEnd();

    // Commment or empty line.
    if(!title || title.charAt(0) === "#") continue;

    // Potential section title found.
    if (!indentation) {
      if (title.toUpperCase() === title) {
        // Check if separator.
        (isSep = SPECIAL_CHARS_RE.test(title)) && (j = i);
        isLastSep = false;

        // Invalid separator.
        (isSep && !SEP_RE.test(title))
          && feedback.push({ type: "error", message: `Invalid separator "${line}", should be ---`, line: i + 1 });
        
        // Inconsistent separator.
        isSep && (
          sep && sep !== title && feedback.push({ type: "warning", message: `Inconsistent separator "${title}" with "${sep}"`, line: i + 1 })
        )

        // Missing separator.
        !lastTitle
          || ((isLastSep = SPECIAL_CHARS_RE.test(lastTitle)) && !isSep)
          || feedback.push({ type: "error", message: `Missing separator --- before section "${title}"`, line: i + 1 });
        
        // Missing section.
        !lastTitle
          || (!isLastSep && isSep)
          || feedback.push({ type: "error", message: `Missing section before separator "${title}"`, line: i + 1 });

        // Missing content between section and separator.
        lastTitle && !hasSectionContent
          && feedback.push({ type: "error", message: `Missing content between "${lastTitle}" section and ${isSep && "separator" || "section"} "${title}"`, line: i + 1 });

        // Duplicate section.
        isSep || (
          titles.has(title) && feedback.push({ type: "error", message: `Section "${title}" already exists`, line: i + 1 }),
          titles.add(title)
        );

        isSep || (
          // Reset content section flag.
          hasSectionContent = false,
          // Update the last title.
          lastTitle = title
        );
      } else {
        hasSectionContent = true;
        feedback.push({ type: "warning", message: `Line "${title}" should be indented under a section`, line: i + 1 });
      }
    } else {
      hasSectionContent = true;
    }
  }

  // Check if we end with a separator.
  isSep && feedback.push({ type: "error", message: `Cannot end with a separator`, line: j });

  // Check for required sections.
  titles.has("TASK") || titles.has("GOAL") || feedback.push({ type: "error", message: `Missing TASK or GOAL section`, line: null });
  titles.has("ROLE") || feedback.push({ type: "error", message: `Missing ROLE section`, line: null });
  titles.has("INPUT") || feedback.push({ type: "error", message: `Missing INPUT section`, line: null });
  titles.has("OUTPUT") || feedback.push({ type: "error", message: `Missing OUTPUT section`, line: null });

  return feedback;
}

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(checkSections, "checkSections", {
  value: checkSections
}));