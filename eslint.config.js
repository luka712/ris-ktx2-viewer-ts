import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const UI_AGNOSTIC = 'src/components/ui must stay app-agnostic: no store, features, service, hooks, model, ris-framework or ris-ktx2 imports.'

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
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {name: 'ris-framework', message: UI_AGNOSTIC},
          {name: 'ris-ktx2', message: UI_AGNOSTIC},
        ],
        patterns: [
          {
            group: [
              'ris-framework/*',
              'ris-ktx2/*',
              '**/store',
              '**/store/**',
              '**/features',
              '**/features/**',
              '**/service',
              '**/service/**',
              '**/hooks',
              '**/hooks/**',
              '**/model',
              '**/model/**',
              '@/store',
              '@/store/**',
              '@/features',
              '@/features/**',
              '@/service',
              '@/service/**',
              '@/hooks',
              '@/hooks/**',
              '@/model',
              '@/model/**',
              '~/store',
              '~/store/**',
              '~/features',
              '~/features/**',
              '~/service',
              '~/service/**',
              '~/hooks',
              '~/hooks/**',
              '~/model',
              '~/model/**',
              'src/store',
              'src/store/**',
              'src/features',
              'src/features/**',
              'src/service',
              'src/service/**',
              'src/hooks',
              'src/hooks/**',
              'src/model',
              'src/model/**',
            ],
            message: UI_AGNOSTIC,
          },
        ],
      }],
    },
  },
])
