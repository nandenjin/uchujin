import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'

export default defineConfig(
  {
    ignores: ['node_modules', 'dist'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier
)
