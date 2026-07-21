import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['lib/**/*.js', 'server.js', 'tests/unit/**/*.js', 'tests/functional/**/*.js', 'tests/integration/**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-path-concat': 'warn',
            'no-buffer-constructor': 'off',
        },
    },
];
