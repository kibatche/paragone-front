import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["public/vendor/**", "public/dist/**", "ui/hermes/skin.generated.ts", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ["ui/**/*.ts", "ui/**/*.tsx"] })),
  {
    files: ["ui/**/*.ts", "ui/**/*.tsx"],
    languageOptions: { sourceType: "module", globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
