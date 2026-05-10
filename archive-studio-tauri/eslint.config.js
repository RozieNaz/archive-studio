import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";

export default [
  js.configs.recommended,
  reactPlugin.configs.flat.recommended,
  {
    files: ["**/*.jsx", "**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        document: "readonly",
        window: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        AbortController: "readonly",
        Blob: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        navigator: "readonly",
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react/prop-types": "off",
      "no-unused-vars": "warn"
    }
  }
];
