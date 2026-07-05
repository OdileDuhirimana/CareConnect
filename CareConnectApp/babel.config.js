// Required for both Metro (Expo's bundler) and Jest to correctly transform
// Flow types, JSX, and TypeScript syntax used throughout React Native and
// its dependencies (e.g. @react-native/js-polyfills). This file was
// missing from the original project — Metro falls back to an implicit
// default when none is present, which is why `expo start` still worked,
// but Jest has no equivalent fallback and fails to parse any file that
// transitively imports Flow-typed React Native internals. Adding this is
// a prerequisite for the Jest test suite introduced alongside it.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
