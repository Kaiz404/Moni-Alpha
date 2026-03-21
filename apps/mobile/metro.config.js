const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

const baseConfig = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});

const kyselyShim = path.resolve(__dirname, "kysely-hermes-shim.js");
const originalResolveRequest = baseConfig.resolver.resolveRequest;

baseConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "kysely") {
    return { type: "sourceFile", filePath: kyselyShim };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = baseConfig;
