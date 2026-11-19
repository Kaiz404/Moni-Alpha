import { sharedConfig } from '@repo/eslint-config/shared';

/**
 * The shared ban keeps Legend out of pure packages. This package is the Legend store both apps
 * mount, so Legend's platform-free entry points are its subject. Its React bindings and the
 * platform persistence plugins stay banned: each app hands those in.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...sharedConfig,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react-native', 'react-native-*', 'expo', 'expo-*', 'next', 'next/*', 'react', 'react-dom', 'react-dom/*'],
              message: 'Shared packages run on the phone and the web; keep platform code in the app.',
            },
            {
              group: [
                '@legendapp/state/react',
                '@legendapp/state/react-*',
                '@legendapp/state/persist-plugins/*',
                '!@legendapp/state/persist-plugins/local-storage',
              ],
              message: 'Each app hands the store its persistence plugin and its React bindings.',
            },
          ],
        },
      ],
    },
  },
];
