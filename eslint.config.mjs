import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: [
            'dist/**',
            'coverage/**',
            'node_modules/**',
            'docs-site/**',
            '**/*.d.ts',
        ],
    },
    { files: ['**/*.{js,mjs,cjs,ts}'] },
    {
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        // Tests exercise the renderer through loosely-typed jsPDF internals and
        // deliberately malformed options, so the stricter source rules do not apply.
        files: ['test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
];
