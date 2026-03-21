/**
 * Metro resolves the `kysely` package to this shim so Hermes never bundles
 * kysely's main `index.js`, which re-exports `FileMigrationProvider` — that
 * module uses dynamic `import()` with a non-literal path, which Hermes cannot
 * compile. Requires must stay static strings so Metro can bundle them.
 *
 * `kysely` is a direct dependency so `./node_modules/kysely/...` resolves here.
 */
module.exports = {
  sql: require("./node_modules/kysely/dist/cjs/raw-builder/sql.js").sql,
  Kysely: require("./node_modules/kysely/dist/cjs/kysely.js").Kysely,
  SqliteAdapter: require("./node_modules/kysely/dist/cjs/dialect/sqlite/sqlite-adapter.js")
    .SqliteAdapter,
  SqliteIntrospector: require("./node_modules/kysely/dist/cjs/dialect/sqlite/sqlite-introspector.js")
    .SqliteIntrospector,
  SqliteQueryCompiler: require("./node_modules/kysely/dist/cjs/dialect/sqlite/sqlite-query-compiler.js")
    .SqliteQueryCompiler,
};
