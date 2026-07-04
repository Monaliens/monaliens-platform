module.exports = {
  extends: ['react-app', 'react-app/jest'],
  env: {
    es2020: true,
  },
  rules: {
    // Downgrade errors to warnings or disable them
    'no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'import/no-anonymous-default-export': 'off',
    // Hide source map related warnings
    'import/no-webpack-loader-syntax': 'off',
    // Other rules...
  },
  ignorePatterns: [
    'node_modules/',
    'build/',
    'dist/',
    // Exclude Reown AppKit library files from ESLint checks
    '**/node_modules/@reown/**/*'
  ]
}; 