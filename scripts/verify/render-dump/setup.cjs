// A Jest setupFilesAfterEnv for apps/mobile/__tests__/routes.test.tsx. With RENDER_DUMP=<dir>, each
// route visit writes what it rendered to <dir>/<route>.<full|empty>.<light|dark>.json just before
// the visit unmounts. It wraps the testing library from outside the test file, so it dumps any
// commit's routes test, an old base included. scripts/verify/render-parity.sh runs it.
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { format, serialize } = require('./serialize.cjs');

const dir = process.env.RENDER_DUMP;
// Resolved from the app, not from this file, which lives outside the app's node_modules.
const app = { paths: [process.cwd()] };

function visitName() {
  const match = /^(\S+)\.tsx? (seeded|empty)\b/.exec(expect.getState().currentTestName ?? '');
  if (!match) return null;
  const { theme } = jest.requireMock(require.resolve('uniwind', app)).useUniwind();
  return `${match[1]}.${match[2] === 'seeded' ? 'full' : 'empty'}.${theme}`;
}

if (dir) {
  jest.mock(require.resolve('expo-router/testing-library', app), () => {
    const actual = jest.requireActual(require.resolve('expo-router/testing-library', app));
    let mounted = false;
    // Copies the descriptors, not the values: `screen` is a getter that follows the latest render.
    return Object.defineProperties({}, {
      ...Object.getOwnPropertyDescriptors(actual),
      renderRouter: {
        enumerable: true,
        value: (...args) => {
          mounted = true;
          return actual.renderRouter(...args);
        },
      },
      cleanup: {
        enumerable: true,
        value: () => {
          const name = mounted ? visitName() : null;
          mounted = false;
          if (name) {
            const file = join(dir, `${name}.json`);
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, format(serialize(actual.screen.toJSON())));
          }
          return actual.cleanup();
        },
      },
    });
  });
}
