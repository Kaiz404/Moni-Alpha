// Route tests freeze the clock and read local-time copy, so CI and a laptop must agree.
process.env.TZ = 'Asia/Kuala_Lumpur';

module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/lib', '<rootDir>/components', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  transform: { '/scripts/e2e/fixtures\\.mjs$': 'babel-jest' },
  moduleNameMapper: {
    '^react$': require.resolve('react'),
    '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
    '^react/jsx-dev-runtime$': require.resolve('react/jsx-dev-runtime'),
    '^@/(.*)$': '<rootDir>/$1',
    // pnpm copies a file: module under node_modules, where Jest leaves its TypeScript untransformed.
    '^moni-theme-reveal$': '<rootDir>/modules/moni-theme-reveal',
  },
};
