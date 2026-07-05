module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  overrides: [
    {
      // Test files are internal-only and read top-to-bottom with their
      // assertions; requiring JSDoc on every small helper adds noise
      // without adding clarity the way it does for exported production
      // functions.
      files: ["**/__tests__/**/*.ts"],
      env: {jest: true},
      rules: {
        "require-jsdoc": "off",
      },
    },
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    // The Google style guide's default of 80 is stricter than this
    // codebase has ever actually followed (many pre-existing lines already
    // exceeded it); 120 is a still-strict, more realistic limit for
    // TypeScript with generics and longer error messages.
    "max-len": ["error", {"code": 120}],
  },
};
