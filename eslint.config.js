import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Demo local: sin red.' }],
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'Sin aleatoriedad en hechos de muestra.' },
        { selector: "MemberExpression[object.name='Date'][property.name='now']", message: 'Usar reloj inyectable del store.' },
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Sin HTML arbitrario.' },
      ],
    },
  },
);
