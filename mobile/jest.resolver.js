// Resolver combinado para o Jest:
// - mantém o fix do preset do React Native (remove o campo "exports" do
//   react-native para permitir imports profundos como "react-native/Libraries/...");
// - soma o fix do react-native-worklets (node_modules/react-native-worklets/jest/resolver.js):
//   dentro do próprio pacote, ignora as variantes ".native.ts" para cair na
//   implementação não-nativa, que é a que funciona sem o módulo nativo carregado
//   (é o que faz o mock do Reanimated não travar em "loadUnpackers").
const resolverReactNative = require("@react-native/jest-preset/jest/resolver.js");

module.exports = (request, options) => {
  const ehWorklets = options.basedir.includes("react-native-worklets") || request.includes("react-native-worklets");

  if (!ehWorklets) return resolverReactNative(request, options);

  return resolverReactNative(request, {
    ...options,
    extensions: options.extensions?.filter((extensao) => !extensao.includes("native")),
  });
};
