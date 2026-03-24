import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        URL: "readonly",
        localStorage: "readonly",
        FormData: "readonly",
        AbortController: "readonly",
        Blob: "readonly",
        File: "readonly",
        alert: "readonly",
        confirm: "readonly",
        requestAnimationFrame: "readonly",
        HTMLElement: "readonly",
        CustomEvent: "readonly",
        performance: "readonly",
        structuredClone: "readonly",
        atob: "readonly",
        btoa: "readonly",
        Worker: "readonly",
        Response: "readonly",
        ReadableStream: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        crypto: "readonly",
        EventSource: "readonly",
      },
    },
    settings: {
      react: { version: "19" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/workers/**/*.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        postMessage: "readonly",
        onmessage: "writable",
        importScripts: "readonly",
      },
    },
  },
];
