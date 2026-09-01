import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-config-next ainda é um config no formato antigo; FlatCompat faz a ponte
// para o flat config exigido pelo ESLint 9.
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'supabase/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Server actions e queries usam o client tipado do Supabase, onde alguns
      // retornos são `any` por natureza do postgrest-js.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

export default eslintConfig;
