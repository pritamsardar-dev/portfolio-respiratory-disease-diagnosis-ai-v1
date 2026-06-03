// npm install -D eslint @eslint/js globals
// npm install -D @stylistic/eslint-plugin
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  {
    ignores: ["dist", "build", "node_modules", ".vite", "coverage", "*.min.js"],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,jsx,mjs,cjs}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.browser,
        ...globals.node,
      },

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    plugins: {
      "@stylistic": stylistic,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },

    rules: {
      ...reactHooks.configs.recommended.rules,

      semi: ["error", "always"],

      quotes: [
        "error",
        "double",
        {
          avoidEscape: true,
        },
      ],

      indent: ["error", 2],

      "comma-dangle": ["error", "always-multiline"],

      "no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^[A-Z_]",
        },
      ],

      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
        },
      ],

      "@stylistic/jsx-indent-props": ["error", 2],

      "@stylistic/jsx-closing-bracket-location": ["error", "line-aligned"],

      "@stylistic/jsx-max-props-per-line": "off",

      "@stylistic/jsx-one-expression-per-line": "off",

      // Onnly warning not enforce formatting
      "@stylistic/max-len": [
        "warn",
        {
          code: 100,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
          ignoreComments: false,
        },
      ],
    },
  },
];
