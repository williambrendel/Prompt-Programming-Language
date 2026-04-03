// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import json from "eslint-plugin-json";
import css from "eslint-plugin-css";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // ✅ JavaScript
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },

  // ✅ JSON
  {
    files: ["**/*.json"],
    plugins: { json },
    rules: {
      "json/*": "error",
    },
  },

  // ✅ CSS
  {
    files: ["**/*.css"],
    plugins: { css },
    rules: {
      "css/no-invalid-double-slash-comments": "error",
    },
  },
]);

