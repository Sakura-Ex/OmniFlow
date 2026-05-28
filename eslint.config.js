import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { pattern: 'src/common/types/**', mode: 'full', type: 'common-types' },
        { pattern: 'src/common/utils/**', mode: 'full', type: 'common-utils' },
        { pattern: 'src/common/db/**', mode: 'full', type: 'common-db' },
        { pattern: 'src/common/schemas/**', mode: 'full', type: 'common-schemas' },
        { pattern: 'src/data/**', mode: 'full', type: 'data' },
        { pattern: 'src/features/calculation/**', mode: 'full', type: 'feature-calculation' },
        { pattern: 'src/features/modifier/**', mode: 'full', type: 'feature-modifier' },
        { pattern: 'src/features/recipe/**', mode: 'full', type: 'feature-recipe' },
        { pattern: 'src/features/canvas/**', mode: 'full', type: 'feature-canvas' },
        { pattern: 'src/features/resource-registry/**', mode: 'full', type: 'feature-resource-registry' },
        { pattern: 'src/features/settings/**', mode: 'full', type: 'feature-settings' },
        { pattern: 'src/features/project/**', mode: 'full', type: 'feature-project' },
        { pattern: 'src/features/file-io/**', mode: 'full', type: 'feature-file-io' },
        { pattern: 'src/features/endpoint/**', mode: 'full', type: 'feature-endpoint' },
        { pattern: 'src/hooks/**', mode: 'full', type: 'global-hooks' },
      ],
    },
    rules: {
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'common-types', allow: ['common-types'] },
          { from: 'common-utils', allow: ['common-types', 'common-utils'] },
          { from: 'common-db', allow: ['common-types', 'common-schemas', 'common-db'] },
          { from: 'common-schemas', allow: ['common-types', 'common-schemas'] },
          { from: 'data', allow: ['common-types', 'data'] },
          { from: 'global-hooks', allow: ['common-types', 'common-utils', 'global-hooks'] },
          { from: 'feature-modifier', allow: ['common-types', 'common-utils', 'data', 'feature-modifier'] },
          { from: 'feature-calculation', allow: ['common-types', 'common-utils', 'feature-modifier', 'feature-settings', 'feature-calculation'] },
          { from: 'feature-recipe', allow: ['common-types', 'common-utils', 'feature-modifier', 'feature-recipe'] },
          { from: 'feature-resource-registry', allow: ['common-types', 'common-utils', 'feature-resource-registry'] },
          { from: 'feature-settings', allow: ['common-types', 'feature-settings'] },
          { from: 'feature-endpoint', allow: ['common-types', 'common-utils', 'feature-endpoint'] },
          { from: 'feature-canvas', allow: ['common-types', 'common-utils', 'common-db', 'feature-calculation', 'feature-recipe', 'feature-modifier', 'feature-resource-registry', 'feature-settings', 'feature-endpoint', 'feature-canvas'] },
          { from: 'feature-project', allow: ['common-types', 'common-utils', 'common-db', 'common-schemas', 'feature-canvas', 'feature-project'] },
          { from: 'feature-file-io', allow: ['common-types', 'common-utils', 'common-schemas', 'feature-recipe', 'feature-canvas', 'feature-modifier', 'feature-file-io'] },
        ],
      }],
    },
  },
])
