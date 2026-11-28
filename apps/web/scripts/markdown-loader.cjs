/* global module */
// Turns an imported `.md` file into a module whose default export is the file's text, so the legal texts in
// docs/legal are bundled at build time instead of read from disk when a page renders.
module.exports = function markdownLoader(source) {
  return `export default ${JSON.stringify(source)};`;
};
