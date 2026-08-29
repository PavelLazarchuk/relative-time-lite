import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const domGlobals = [
    'window',
    'self',
    'navigator',
    'location',
    'localStorage',
    'sessionStorage',
    'fetch',
];

export default tseslint.config(
    { ignores: ['dist/', 'coverage/', 'node_modules/'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        rules: {
            'no-restricted-globals': ['error', ...domGlobals],
        },
    },
    {
        files: ['src/react/**/*.ts'],
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
        },
    },
    {
        files: ['test/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            globals: {
                console: 'readonly',
                URL: 'readonly',
                process: 'readonly',
            },
        },
    },
    prettier
);
