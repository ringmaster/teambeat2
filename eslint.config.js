import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'node_modules/']
	},
	{
		rules: {
			// Disable some TypeScript rules that are too strict for this project
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
			
			// Svelte-specific rules
			'svelte/no-at-html-tags': 'warn',
			'svelte/no-target-blank': 'error',
			'svelte/no-at-debug-tags': 'warn',
			
			// General rules
			'no-console': 'warn',
			'no-debugger': 'error'
		}
	}
];