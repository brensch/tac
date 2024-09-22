module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    semi: ["off"], // Turn off semicolon enforcement
    "object-curly-spacing": ["error", "always"], // Allow spaces inside curly braces
    "max-len": ["off"], // Disable max line length
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-multiple-empty-lines": ["error", { max: 2 }], // Example: Allow up to 2 empty lines
  },
}
