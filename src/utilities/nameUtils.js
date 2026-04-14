"use strict";

const KEYWORDS = new Set([
  "DO",
  "EXECUTE",
  "RUN",
  "CHECK",
  "VALIDATE",
  "EVAL",
  "EVALUATE",
  "FAILURE",
  "NEXT",
  "GOTO",
  "GO_TO",
  "GO TO",
  "TO",
  "IF",
  "THEN",
  "ELSE",
  "ELSEIF",
  "ELSE_IF",
  "ELSE IF",
  "ENDIF",
  "END_IF",
  "EACH",
  "FOR",
  "ENDFOR",
  "END_FOR",
  "WHILE",
  "ENDWHILE",
  "END_WHILE",
  "LOOP",
  "ENDLOOP",
  "END_LOOP",
  "CONTINUE",
  "UNTIL",
  "BREAK",
  "RETURN",
  "STOP",
  "ITERATE",
  "FOREACH",
  "FOR_EACH",
  "FOR EACH",
  "MAP",
  "REDUCE",
  "FILTER",
  "IN",
  "AS",
  "OF",
  "DEFINE",
  "DECLARE",
  "LET",
  "CONST",
  "VAR"
]);

let MIN_KEYWORD_LENGTH = Infinity, MAX_KEYWORD_LENGTH = 0;
KEYWORDS.forEach(v => {
  MIN_KEYWORD_LENGTH = Math.min(MIN_KEYWORD_LENGTH, v.length);
  MAX_KEYWORD_LENGTH = Math.max(MAX_KEYWORD_LENGTH, v.length);
});

const getKeyword = str => (
  str && typeof str === "string"
  && str.length >= MIN_KEYWORD_LENGTH
  && str.length <= MAX_KEYWORD_LENGTH
  && KEYWORDS.has(str = str.toUpperCase())
  && str
);

const isKeyword = str => !!getKeyword(str);

const isTitle = str => {
  if (!str || typeof str !== "string" || str.charCodeAt(0) > 96) return false;
  
  let hasUppercase = false;
  
  // Already checked first character.
  for (let i = 1, l = str.length, code; i !== l; ++i) {
    code = str.charCodeAt(i);
    
    // Lowercase letter or invalid symbol found - immediate fail
    if (code > 95) return false; // lower case or invalid symbol found --> fail
    
    // Uppercase letter found
    code > 64 && code < 91 && (hasUppercase = true);
  }
  
  return hasUppercase;
}

const isVariable = name => name && typeof name === "string" && name.length > 4 && name.length < 8 && (
  name = name.toLowerCase(),
  name.startsWith("input") && name.length < 7
    || name.startsWith("output")
);

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze({
  getKeyword,
  isKeyword,
  isTitle,
  isVariable
});