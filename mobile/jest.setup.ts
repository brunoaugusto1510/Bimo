import "@testing-library/react-native";
import "react-native-gesture-handler/jestSetup";

// Sem isto o módulo nativo é null em teste e qualquer suíte que toque a tela
// de Nota falha ao carregar ("NativeModule: AsyncStorage is null"). O mock
// vem pronto no próprio pacote.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("react-native-reanimated", () => {
  const mock = require("react-native-reanimated/mock");
  // O mock oficial não implementa useFrameCallback — o próprio arquivo diz
  // "useFrameCallback: ADD ME IF NEEDED"
  // (node_modules/react-native-reanimated/lib/module/mock.js). Sem isto,
  // qualquer componente que rode o loop de quadros quebra na montagem.
  //
  // Em teste não existe loop de quadros: devolvemos um controle inerte para o
  // componente montar. A lógica de cada quadro é coberta por simulacao.test.ts,
  // que não precisa de render.
  return { ...mock, useFrameCallback: () => ({ setActive: jest.fn(), isActive: false }) };
});
