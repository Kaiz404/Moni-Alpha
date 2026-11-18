import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    // The verify drive runs in Node and passes callbacks into the page, so it sees both sets of globals.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        document: "readonly",
        getComputedStyle: "readonly",
        innerWidth: "readonly",
        localStorage: "readonly",
      },
    },
    rules: { "turbo/no-undeclared-env-vars": "off" },
  },
];
