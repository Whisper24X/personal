import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import pluginBoundaries from 'eslint-plugin-boundaries'
import skipFormatting from 'eslint-config-prettier/flat'

/** Five-partition layer matrix — aligned with `.agents/skills/frontend-architecture/references/spa-architecture.md` */
const boundariesElements = [
  { type: 'shared', pattern: 'src/shared/**/*' },
  { type: 'api', pattern: 'src/api/**/*' },
  { type: 'features', pattern: 'src/features/*', mode: 'folder' as const, capture: ['feature'] },
  { type: 'pages', pattern: 'src/pages/**/*' },
  { type: 'app', pattern: 'src/app/**/*' },
  { type: 'contracts', pattern: 'src/types/**/*' },
] as const

const boundariesDependencyRules = [
  { from: { type: 'shared' }, allow: { to: { type: ['shared', 'contracts'] } } },
  { from: { type: 'api' }, allow: { to: { type: ['shared', 'api', 'contracts'] } } },
  // pages / features 使用 @app/stores、应用级 composable 等为常态（装配层 Pinia）
  { from: { type: 'features' }, allow: { to: { type: ['shared', 'api', 'features', 'app', 'contracts'] } } },
  { from: { type: 'pages' }, allow: { to: { type: ['shared', 'api', 'features', 'pages', 'app', 'contracts'] } } },
  { from: { type: 'app' }, allow: { to: { type: ['shared', 'api', 'features', 'pages', 'app', 'contracts'] } } },
  { from: { type: 'contracts' }, allow: { to: { type: 'contracts' } } },
  {
    from: { type: 'features' },
    disallow: {
      to: { type: 'features', captured: { feature: '!{{ from.captured.feature }}' } },
      dependency: { source: '@features/*/**' },
    },
    message:
      'Cross-feature imports must use the target feature public entry (e.g. @features/<domain>), not deep paths under another domain.',
  },
] as const

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  {
    files: ['src/shared/ui/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    files: ['src/**/*.vue'],
    rules: {
      // §4.2：默认 >600 为 error；400 行软上限靠评审（ESLint 单条 max-lines 无法同时 warn/error 两档）
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },

  // Known large SFCs — warn until split (see quality-gate / AGENTS.md)
  {
    files: [
      'src/features/business-lines/BusinessLineManagementPanelInner.vue',
      'src/features/tasks/detail/TaskEnvironmentGate.vue',
    ],
    rules: {
      'max-lines': ['warn', { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },

  {
    files: ['src/**/*.{vue,ts,mts,tsx}'],
    plugins: { boundaries: pluginBoundaries },
    settings: {
      'boundaries/elements': [...boundariesElements],
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.app.json', './tsconfig.vitest.json'],
        },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkUnknownLocals: false,
          rules: [...boundariesDependencyRules],
        },
      ],
      'boundaries/element-types': 'off',
      'boundaries/entry-point': 'off',
      'boundaries/external': 'off',
      'boundaries/no-ignored': 'off',
      'boundaries/no-private': 'off',
      'boundaries/no-unknown': 'off',
      'boundaries/no-unknown-files': 'off',
    },
  },

  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/src/views/**', '@/views/*'],
              message: 'Use @pages/ for route pages (five-partition migration).',
            },
            {
              group: ['**/src/hooks/**', '@/hooks/*'],
              message: 'Use @shared/composables, @app/composables, or @features/*/composables.',
            },
          ],
        },
      ],
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
