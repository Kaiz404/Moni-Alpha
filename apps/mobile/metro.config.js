const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Gradle build output under node_modules (e.g. after EAS fingerprint / android
// builds) can appear and vanish while Metro watches on Windows, crashing with
// ENOENT. Match anywhere in the path — exclusionList's trailing $ is too strict.
config.resolver.blockList =
  /[/\\]node_modules[/\\].*[/\\]android[/\\].*[/\\]build|[/\\]__tests__[/\\]|[/\\]\.gradle[/\\]|(?:^|[/\\])android[/\\]build[/\\]/;

// Pin React to the mobile app's copy so @legendapp/state doesn't pick up
// react@19.2.0 from the web app in this pnpm monorepo.
const pinnedModules = ["react", "react-dom", "react-native"];
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (pinnedModules.includes(moduleName)) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});
