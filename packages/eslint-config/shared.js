import { config as baseConfig } from "./base.js";

/**
 * For platform-free packages that both the phone and the web import. The shared tsconfig has no DOM
 * library, which catches browser globals; this catches platform modules.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const sharedConfig = [
  ...baseConfig,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react-native", "react-native-*", "expo", "expo-*", "next", "next/*", "react-dom", "react-dom/*", "@legendapp/*"],
              message: "Shared packages run on the phone and the web; keep platform code in the app.",
            },
          ],
        },
      ],
    },
  },
];
