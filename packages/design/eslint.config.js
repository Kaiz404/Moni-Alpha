import { sharedConfig } from '@repo/eslint-config/shared';

/** @type {import("eslint").Linter.Config[]} */
export default [...sharedConfig, { ignores: ['src/icons.generated.ts'] }];
