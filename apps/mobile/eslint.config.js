// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Existing effect-driven sync and live-time UI intentionally use these
      // patterns. Keep dependency validation enabled; only disable the React
      // Compiler rules they are incompatible with.
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    ignores: ['components/ui/text.tsx', '**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Text'],
              message:
                "Import Text from '@/components/ui/text' so it renders in Funnel Display. scripts/codemods/text-to-v2.mjs rewrites the import and the font-* weight classes.",
            },
            {
              name: 'expo-haptics',
              message:
                "Call the moment functions in '@/lib/haptics' (keypadTap, approve, notMine, ...) so every haptic follows the tokens.md table.",
            },
          ],
        },
      ],
    },
  },
]);
