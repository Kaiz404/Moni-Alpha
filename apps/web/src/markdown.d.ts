/** A `.md` import is the file's text (`scripts/markdown-loader.cjs`, and the `markdown` plugin in vitest.config.ts). */
declare module '*.md' {
  const text: string;
  export default text;
}
