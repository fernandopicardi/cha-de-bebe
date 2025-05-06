const js = require('@eslint/js');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const react = require('eslint-plugin-react');
const typescriptEslint = require('@typescript-eslint/parser');
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin')

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
        parser: typescriptEslint,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
          project: ['./tsconfig.json']
        }
    },
    plugins: {
      'jsx-a11y': jsxA11y,
      react: react,
      '@typescript-eslint': typescriptEslintPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      ...react.configs.recommended.rules,
      'react/no-unescaped-entities': [
        'error',
        {
          forbid: ['>', '{', '}'],
        },
      ],
      'no-whitespace-before-property': 'error',
      'react/no-children-prop': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
];