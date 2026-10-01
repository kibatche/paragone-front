import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["public/vendor/**", "node_modules/**"] },
  js.configs.recommended,
  { files: ["public/**/*.js"], languageOptions: { sourceType: "module", globals: globals.browser } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["tests/**/*.ts"] })),
  { files: ["tests/**/*.ts"], languageOptions: { globals: globals.node } },
];
