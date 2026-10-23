import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'
import jsdoc from 'eslint-plugin-jsdoc'
import { defineConfig, globalIgnores } from 'eslint/config'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig([
  globalIgnores(['dist', '.pytest_cache/**', '.venv/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { jsdoc },
    settings: {
      jsdoc: {
        tagNamePreference: {
          param: 'param',
          returns: 'returns',
          example: 'example',
        },
        preferredTypes: {
          Object: 'Record<string, unknown>',
          object: 'Record<string, unknown>',
        },
      },
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries, jsdoc },
    settings: {
      'boundaries/root-path': projectRoot,
      'import/resolver': {
        typescript: { project: fileURLToPath(new URL('./tsconfig.app.json', import.meta.url)) },
      },
      'boundaries/elements': [
          { pattern: 'src/app/**', mode: 'full', type: 'app-shell' },
          { pattern: 'src/common/components/**', mode: 'full', type: 'common-components' },
          { pattern: 'src/common/i18n/**', mode: 'full', type: 'common-i18n' },
          { pattern: 'src/common/units/**', mode: 'full', type: 'common-units' },
          { pattern: 'src/common/types/**', mode: 'full', type: 'common-types' },
          { pattern: 'src/common/utils/**', mode: 'full', type: 'common-utils' },
          { pattern: 'src/common/db/**', mode: 'full', type: 'common-db' },
          { pattern: 'src/common/schemas/**', mode: 'full', type: 'common-schemas' },
          { pattern: 'src/data/**', mode: 'full', type: 'data' },
          { pattern: 'src/features/calculation/**', mode: 'full', capture: ['path'], type: 'feature-calculation' },
          { pattern: 'src/features/modifier/**', mode: 'full', capture: ['path'], type: 'feature-modifier' },
          { pattern: 'src/features/recipe/**', mode: 'full', capture: ['path'], type: 'feature-recipe' },
          { pattern: 'src/features/canvas/**', mode: 'full', capture: ['path'], type: 'feature-canvas' },
          { pattern: 'src/features/resource-registry/**', mode: 'full', capture: ['path'], type: 'feature-resource-registry' },
          { pattern: 'src/features/settings/**', mode: 'full', capture: ['path'], type: 'feature-settings' },
          { pattern: 'src/features/project/**', mode: 'full', capture: ['path'], type: 'feature-project' },
          { pattern: 'src/features/file-io/**', mode: 'full', capture: ['path'], type: 'feature-file-io' },
          { pattern: 'src/features/endpoint/**', mode: 'full', capture: ['path'], type: 'feature-endpoint' },
          { pattern: 'src/hooks/**', mode: 'full', type: 'global-hooks' },
        ],
      jsdoc: {
        tagNamePreference: {
          param: 'param',
          returns: 'returns',
          example: 'example',
        },
        preferredTypes: {
          Object: 'Record<string, unknown>',
          object: 'Record<string, unknown>',
        },
      },
    },
    rules: {
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'common-components', allow: ['common-components', 'common-i18n', 'common-types', 'common-utils'] },
          { from: 'app-shell', allow: ['common-components', 'common-i18n', 'common-types', 'common-utils', 'global-hooks', 'feature-calculation', 'feature-canvas', 'feature-recipe', 'feature-settings', 'feature-endpoint', 'feature-resource-registry', 'feature-file-io', 'app-shell'] },
          { from: ['feature-calculation', 'feature-canvas', 'feature-modifier', 'feature-recipe', 'feature-resource-registry', 'feature-endpoint', 'feature-project', 'feature-settings'], allow: ['common-components'] },
          { from: 'common-i18n', allow: ['common-i18n'] },
          { from: 'common-units', allow: ['common-types', 'common-units'] },
          { from: 'common-types', allow: ['common-types'] },
          { from: 'common-utils', allow: ['common-units', 'common-types', 'common-utils'] },
          { from: 'common-db', allow: ['common-types', 'common-schemas', 'common-db'] },
          { from: 'common-schemas', allow: ['common-types', 'common-schemas'] },
          { from: 'data', allow: ['common-types', 'common-utils', 'data'] },
          { from: 'global-hooks', allow: ['common-i18n', 'common-units', 'common-types', 'common-utils', 'global-hooks'] },
          { from: 'feature-modifier', allow: ['common-i18n', 'common-units', 'common-types', 'common-utils', 'data', 'feature-modifier'] },
          { from: 'feature-calculation', allow: ['common-i18n', 'common-schemas', 'common-units', 'common-types', 'common-utils', 'feature-modifier', 'feature-settings', 'feature-calculation'] },
          { from: 'feature-recipe', allow: ['data', 'feature-resource-registry', 'common-i18n', 'common-units', 'common-types', 'common-utils', 'feature-modifier', 'feature-settings', 'feature-recipe'] },
          { from: 'feature-resource-registry', allow: ['common-i18n', 'common-units', 'common-types', 'common-utils', 'feature-settings', 'feature-resource-registry'] },
          { from: 'feature-settings', allow: ['common-i18n', 'common-units', 'common-types', 'feature-settings'] },
          { from: 'feature-endpoint', allow: ['feature-settings', 'common-i18n', 'common-units', 'common-types', 'common-utils', 'feature-endpoint'] },
          { from: 'feature-canvas', allow: ['common-i18n', 'common-schemas', 'common-units', 'common-types', 'common-utils', 'common-db', 'feature-calculation', 'feature-recipe', 'feature-modifier', 'feature-resource-registry', 'feature-settings', 'feature-endpoint', 'feature-canvas'] },
          { from: 'feature-project', allow: ['feature-settings', 'common-i18n', 'common-units', 'common-types', 'common-utils', 'common-db', 'common-schemas', 'feature-canvas', 'feature-project'] },
          { from: 'feature-file-io', allow: ['common-i18n', 'common-units', 'common-types', 'common-utils', 'common-schemas', 'feature-recipe', 'feature-canvas', 'feature-modifier', 'feature-settings', 'feature-resource-registry', 'feature-calculation', 'feature-file-io'] },
          // Editors may compose the stores they present; computation retains stricter domain rules.
          { from: [['feature-calculation', { path: 'components/**' }]], allow: ['feature-canvas', 'feature-recipe', 'feature-resource-registry'] },
          { from: [['feature-endpoint', { path: 'components/**' }]], allow: ['feature-canvas', 'feature-recipe', 'feature-resource-registry'] },
          { from: [['feature-recipe', { path: 'components/**' }]], allow: ['global-hooks'] },
          { from: [['feature-modifier', { path: 'modifiers/**/*Card.tsx' }]], allow: ['feature-resource-registry'] },
          // These hooks orchestrate document editing and calculation across existing feature stores.
          { from: [['feature-calculation', { path: 'hooks/useCalculation.ts' }]], allow: ['feature-canvas', 'feature-recipe'] },
          { from: [['feature-recipe', { path: 'hooks/useNode{Editor,Operations}.ts' }]], allow: ['feature-canvas', 'feature-calculation'] },
          // Integration regressions may compose features without broadening production dependencies.
          { from: [['feature-*', { path: '**/*.test.ts' }]], allow: ['feature-*', 'data'] },
        ],
      }],
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: true,
          ClassDeclaration: true,
          MethodDefinition: true,
          ArrowFunctionExpression: false,
        },
        checkConstructors: true,
        checkGetters: true,
        checkSetters: true,
        contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'],
      }],
      'jsdoc/check-param-names': 'warn',
      'jsdoc/check-types': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/require-param': 'warn',
    },
  },
])
