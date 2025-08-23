// eslint.config.js — ESLint v9 (flat config) для TS/React + Vite HMR + Prettier-совместимость
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  // Игноры для производных артефактов/папок
  {
    ignores: [
      'node_modules/',
      'dist/',
      'dist-ssr/',
      'server/dist/',
      '**/coverage/',
      '**/.vite/',
      '**/*.min.*',
    ],
  },

  // Базовые рекомендации JS
  js.configs.recommended,

  // Рекомендации для TypeScript (flat)
  ...tseslint.configs.recommended,

  // React рекомендации (flat)
  reactPlugin.configs.flat.recommended,

  // React Refresh (Vite) — защита от некорректных экспортов компонентов
  reactRefresh.configs.vite,

  // Глобальные настройки окружения и React
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // TypeScript/TSX: парсер, плагины и правила
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        // Если нужен type-aware линтинг, раскомментируйте:
        // project: ['./tsconfig.json', './tsconfig.app.json'],
        // tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/ban-ts-comment': ['warn', { 'ts-ignore': 'allow-with-description' }],
      '@typescript-eslint/no-explicit-any': 'off', // при желании можно сделать 'warn'

      // Базовые полезные
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
    },
  },

  // Stores/infra: допускаем экспорт не-компонентов рядом с провайдерами
  {
    files: ['src/stores/**/*.{ts,tsx}', 'src/config/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Тесты (Vitest): ослабляем часть правил
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Отключение правил, конфликтующих с Prettier (ставим ПОСЛЕДНИМ)
  prettier,
];
