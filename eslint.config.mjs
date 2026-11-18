import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/next-env.d.ts', '.pnpm-store/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx,mts}'], rules: { '@typescript-eslint/consistent-type-imports': 'error' } },
);
