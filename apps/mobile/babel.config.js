module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Needed for reanimated worklets (and any reanimated-based components like carousels).
      'react-native-reanimated/plugin',
      // Separate worklet runtime used by VisionCamera's Frame Processors (react-native-fast-opencv,
      // resize plugin, Skia overlay). Independent of Reanimated's worklets — both can coexist.
      ['react-native-worklets-core/plugin'],
    ],
  };
};
