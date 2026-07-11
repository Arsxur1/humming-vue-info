import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      // Legacy HFO content in repo root — not part of AvatarStudio
      '*.html',
      '*.jsx',
      '*.js',
      '*.css',
      'download',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['{apps,packages}/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
);
