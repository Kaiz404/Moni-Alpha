module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Needed for reanimated worklets (and any reanimated-based components like carousels).
      'react-native-reanimated/plugin',
      '@babel/plugin-transform-async-generator-functions'
    ],
  };
};
