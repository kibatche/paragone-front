import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["public/vendor/**", "public/dist/**", "node_modules/**"] },
  js.configs.recommended,
  { files: ["public/**/*.js"], languageOptions: { sourceType: "module", globals: globals.browser } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["tests/**/*.ts", "ui/**/*.ts", "ui/**/*.tsx"] })),
  { files: ["tests/**/*.ts"], languageOptions: { globals: globals.node } },
  {
    files: ["ui/**/*.ts", "ui/**/*.tsx"],
    languageOptions: { sourceType: "module", globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
