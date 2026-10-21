import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  MOBILE_ROOT,
  baseList,
  ratchet,
  readList,
  readSource,
  sourceFiles,
  writeList,
} from './ratchet.mjs';

const EXEMPT_PATH = join(
  MOBILE_ROOT,
  'scripts',
  'lint',
  'test-id-exempt.txt',
);

// JSX elements that must carry a testID built by tid() from lib/test-ids.ts. Add each v2 control
// here as it lands.
export const CONTROLS = [
  'Pressable',
  'TextInput',
  'Switch',
  'Press',
  'Button',
  'HeaderIconButton',
  'MoniButton',
  'FormField',
  'PickerField',
];

// A component that wraps a control passes its own testID prop through, typed as TestId, so the
// caller's tid() reaches the native view.
function isTidValue(expression) {
  if (!expression) return false;
  if (ts.isCallExpression(expression)) {
    return (
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === 'tid'
    );
  }
  if (ts.isIdentifier(expression))
    return expression.text === 'testID';
  if (ts.isPropertyAccessExpression(expression))
    return expression.name.text === 'testID';
  return false;
}

function testIdProblem(attributes) {
  const testId = attributes.properties.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText() === 'testID',
  );
  if (!testId) return 'no testID';
  const value = testId.initializer;
  if (
    value &&
    ts.isJsxExpression(value) &&
    isTidValue(value.expression)
  )
    return null;
  return 'testID is not a tid() call';
}

export function testIdViolations(file, source) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const violations = [];
  const visit = (node) => {
    if (
      ts.isJsxOpeningElement(node) ||
      ts.isJsxSelfClosingElement(node)
    ) {
      const control = node.tagName.getText().split('.').pop();
      const problem = CONTROLS.includes(control)
        ? testIdProblem(node.attributes)
        : null;
      if (problem) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        violations.push({ file, line: line + 1, control, problem });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

export function checkTestIds({ violations, exempt, base }) {
  const result = ratchet({
    current: violations.map((v) => v.file),
    listed: exempt,
    base,
  });
  const unlisted = new Set(result.unlisted);
  return {
    ...result,
    failing: violations.filter((v) => unlisted.has(v.file)),
  };
}

function main() {
  const violations = sourceFiles().flatMap((file) =>
    testIdViolations(file, readSource(file)),
  );
  if (process.argv.includes('--write')) {
    writeList(
      EXEMPT_PATH,
      [
        `v1 files with a ${CONTROLS.join(', ')} that has no tid() testID. They may stay until rebuilt.`,
        'The list only shrinks. Regenerate: pnpm --filter moni lint:test-ids --write',
      ],
      violations.map((v) => v.file),
    );
  }
  const { ref, entries: base } = baseList(EXEMPT_PATH);
  const exempt = readList(EXEMPT_PATH);
  const { failing, stale, grownBy } = checkTestIds({
    violations,
    exempt,
    base,
  });
  for (const v of failing)
    console.log(`${v.file}:${v.line}: ${v.control}: ${v.problem}`);
  for (const entry of stale)
    console.log(`stale exempt entry: ${entry}`);
  if (grownBy)
    console.log(
      `test-id-exempt.txt grew by ${grownBy} entries over ${ref}`,
    );
  if (base === null)
    console.log(
      `no test-id-exempt.txt at ${ref}, nothing to compare its size with`,
    );
  const failingFiles = new Set(failing.map((v) => v.file)).size;
  console.log(
    `${failing.length} controls without a tid() testID in ${failingFiles} files, ${exempt.length} exempt files`,
  );
  process.exitCode =
    failing.length || stale.length || grownBy ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
)
  main();
