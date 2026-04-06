const getLines = require("./getLines")

const SEP_RE = /^\-\-\-+$/;
const SPECIAL_CHARS_RE = /^[^a-zA-Z0-9]+$/;

/**
 * @file checkSections.js
 * @module ppl/utilities/validate/checkSections
 * @description
 * Validates the macro-structural organization of a document using 
 * section titles and infix separators.
 *
 * This function enforces a "Section-Separator-Section" pattern where a section is a Title and a Content.
 * The separator (`---`) is treated as a mandatory boundary between distinct blocks but is 
 * strictly forbidden at the beginning or end of the document.
 *
 * ## Structural rules
 *
 * | Sequence           | Validity | Note                                     |
 * |--------------------|----------|------------------------------------------|
 * | Title -> Content   | Valid    | Standard section start.                  |
 * | Content -> Sep     | Valid    | Correctly closing a block to start next. |
 * | Sep -> Title       | Valid    | Starting a new block after separator.    |
 * | Content -> Title   | ERROR    | Missing separator between sections.      |
 * | Start -> Sep       | ERROR    | Document cannot start with separator.    |
 * | Content -> EOF     | Valid    | Last section requires no separator.      |
 * | Sep -> EOF         | ERROR    | Trailing separators are forbidden.       |
 *
 * ## Design rationale
 * 
 * - **Infix Logic**: The state machine ensures that every transition from 
 *   one section's content to a new section's title is mediated by a separator.
 * - **Strict Indentation**: Content must be indented to be associated with 
 *   the preceding title, distinguishing it from structural markers.
 * - **State Tracking**: Maintains `previousType` (title/content/separator) 
 *   and `previousSep` to validate document structure and separator consistency.
 *
 * @function checkSections
 *
 * @param {string} content - Raw string content.
 * @param {Array} [feedback=[]] - Error/Warning collector.
 *
 * @returns {Array} The updated feedback array.
 * 
 * @example
 * ### Valid document
 * ```markdown
 * ROLE
 *   You are a code reviewer.
 * ---
 * INPUT
 *   The code is a JavaScript function.
 * ---
 * TASK
 *   Identify bugs and suggest improvements.
 * ---
 * OUTPUT
 *   A list of issues found.
 * ```
 *
 * @example
 * ### Missing separator (ERROR)
 * ```markdown
 * ROLE
 *   Content here
 * INPUT
 *   Missing separator above
 * ```
 * **Error:** `Missing separator before this section title` at line 4 (INPUT)
 *
 * @example
 * ### Empty section (ERROR)
 * ```markdown
 * ROLE
 * ---
 * INPUT
 *   Content here
 * ```
 * **Error:** `Empty section content before separator` at line 3 (---)
 *
 * @example
 * ### Trailing separator (ERROR)
 * ```markdown
 * ROLE
 *   Content
 * ---
 * ```
 * **Error:** `Cannot end with a separator` at line 4
 *
 * @example
 * ### Missing indentation (WARNING)
 * ```markdown
 * ROLE
 * Content not indented
 * ---
 * INPUT
 *   Properly indented content
 * ```
 * **Warning:** `Content should be indented under section title` at line 3
 *
 * @example
 * ### Duplicate section (ERROR)
 * ```markdown
 * ROLE
 *   Content
 * ---
 * ROLE
 *   Duplicate section
 * ```
 * **Error:** `Section title already exists line 1` at line 5
 *
 * @example
 * ### Document starts with separator (ERROR)
 * ```markdown
 * ---
 * ROLE
 *   Content
 * ```
 * **Error:** `Prompt cannot start with a separator` at line 1
 *
 */
const checkSections = (content, feedback) => {
  // Normalize input.
  feedback || (feedback = []);
  content || (content = "");

  // Get lines.
  const lines = getLines(content);

  // titles.
  const titles = new Map;
  
  // Check macro sections and separators.
  let previousSep, previousType, j;
  for (let i = 0, l = lines.length; i !== l; ++i) {
    let line = lines[i] || "", trimmed = line.trimStart();
    if (!trimmed) continue; // blank line

    const indentation = line.slice(0, line.length - trimmed.length) || "";
    line = trimmed.trimEnd();

    // Commment or empty line.
    if(!line || line.charAt(0) === "#") continue;

    // Content found.
    if (indentation) {
      previousType === "title" || previousType === "content" 
        || feedback.push({ type: "error", message: `Content is missing a section title`, line: i + 1 });
      
      // Update previous type.
      previousType = "content";
    } else if (line.toUpperCase() === line) { // Either a section title found or a separator of some form.
      // Check if the line is some form of separator.
      if (SPECIAL_CHARS_RE.test(line)) {
        j = i // Record the index of the separator. We cannot have a prompt finishing with a separator.
      
         // Invalid separator.
        SEP_RE.test(line)
          || feedback.push({ type: "error", message: `Invalid separator, should be ---`, line: i + 1 });
        
        // Inconsistent separator.
        previousSep && previousSep.str !== line
          && feedback.push({ type: "warning", message: `Inconsistent separator with last separator line ${previousSep.line}`, line: i + 1 })

        // Empty section.
        previousType === "title"
          && feedback.push({ type: "error", message: `Empty section content before separator`, line: i + 1 });

        // Missing section and content.
        previousType === "separator"
          && feedback.push({ type: "error", message: `No section title and content found between this separator and the separator line ${previousSep.line}`, line: i + 1 });

        // Document starts with a separator.
        previousType
          || feedback.push({ type: "error", message: `Prompt cannot start with a separator`, line: i + 1 });

        // Record last separator.
        previousSep = {str: line, line: i + 1};

        // Update previous type.
        previousType = "separator";
      
      } else { // The line is a real section title.

        // Empty section and missing separator.
        previousType === "title"
          && feedback.push({ type: "error", message: `Empty section content and missing separator before this section title`, line: i + 1 });

        previousType === "content"
          && feedback.push({ type: "error", message: `Missing separator before this section title`, line: i + 1 });

        // Duplicate section.
        const tl = titles.get(line);
        tl === undefined
          || feedback.push({ type: "error", message: `Section title already exists line ${tl}`, line: i + 1 });
        
        // Add title to the set.
        titles.set(line, i + 1);

        // Update previous type.
        previousType = "title";
      }
    } else { // Non indented content.
      (previousType === "title" || previousType === "content")
        && feedback.push({ type: "warning", message: `Content should be indented under section title`, line: i + 1 })
        || feedback.push({ type: "error", message: `Missing section title and incorrect indentation`, line: i + 1 });
          
      // Update previous type.
      previousType = "content";
    }
  }

  // Check if we end with a separator.
  previousType === "separator" && feedback.push({ type: "error", message: `Cannot end with a separator`, line: j + 1 });

  // Check if entire prompt is useless.
  previousType || feedback.push({ type: "error", message: `Empty prompt or prompt contains only comments`, line: null });

  // Check for required sections.
  titles.get("TASK") || titles.get("GOAL") || feedback.push({ type: "error", message: `Missing TASK or GOAL section`, line: null });
  titles.get("ROLE") || feedback.push({ type: "error", message: `Missing ROLE section`, line: null });
  titles.get("INPUT") || feedback.push({ type: "error", message: `Missing INPUT section`, line: null });
  titles.get("OUTPUT") || feedback.push({ type: "error", message: `Missing OUTPUT section`, line: null });

  return feedback;
}

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(checkSections, "checkSections", {
  value: checkSections
}));