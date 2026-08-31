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
  // O controle precisa ser estável entre renders, como o do Reanimated de
  // verdade: um objeto novo por render faria os efeitos que dependem dele
  // re-executarem à toa e o teste mediria algo que o app não faz. Cada controle
  // criado fica em `globalThis.quadrosDeTeste` para os testes poderem afirmar
  // sobre o liga/desliga do loop.
  const { useRef } = require("react") as typeof import("react");

  return {
    ...mock,
    useFrameCallback: () => {
      const referencia = useRef<{ setActive: jest.Mock; isActive: boolean } | null>(null);

      if (referencia.current === null) {
        referencia.current = { setActive: jest.fn(), isActive: false };
        (globalThis as { quadrosDeTeste?: unknown[] }).quadrosDeTeste ??= [];
        (globalThis as { quadrosDeTeste?: unknown[] }).quadrosDeTeste!.push(referencia.current);
      }

      return referencia.current;
    },
  };
});
