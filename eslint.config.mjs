import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const noForEach = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Prefer for..of over Array#forEach' },
    messages: { noForEach: 'Prefer for..of over forEach.' },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'forEach'
        ) {
          context.report({ node, messageId: 'noForEach' })
        }
      },
    }
  },
}

export default tseslint.config(
  { ignores: ['node_modules/', 'coverage/', 'reports/', '.stryker-tmp/', 'dist/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { local: { rules: { 'no-for-each': noForEach } } },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true }],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': true, 'ts-check': true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
      'local/no-for-each': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  // Node-globals + formatting for JS config files and build scripts.
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  prettier,
)
