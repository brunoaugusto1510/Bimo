module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["expo/internal/babel-preset"],
    plugins: ["react-native-worklets/plugin"],
  };
};
