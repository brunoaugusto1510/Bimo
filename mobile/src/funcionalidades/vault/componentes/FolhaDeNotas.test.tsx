import { render, screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { ProvedorDeTema } from "@/compartilhado/tema";
import { FolhaDeNotas } from "./FolhaDeNotas";

type PropsDaFolha = React.ComponentProps<typeof FolhaDeNotas>;

function propsPadrao(sobrescritas: Partial<PropsDaFolha> = {}): PropsDaFolha {
  return {
    notas: [],
    busca: "",
    aoBuscar: jest.fn(),
    noSelecionado: null,
    aoSelecionarNota: jest.fn(),
    aoLimparSelecao: jest.fn(),
    altura: 450,
    alturaMinima: 100,
    alturaMaxima: 800,
    aoArrastar: jest.fn(),
    aoMedirMinimo: jest.fn(),
    aoAbrirNota: jest.fn(),
    aoPerguntar: jest.fn(),
    ...sobrescritas,
  };
}

function elemento(sobrescritas: Partial<PropsDaFolha> = {}) {
  return (
    <ProvedorDeTema>
      <FolhaDeNotas {...propsPadrao(sobrescritas)} />
    </ProvedorDeTema>
  );
}

describe("FolhaDeNotas — altura", () => {
  it("aplica a altura recebida", async () => {
    await render(elemento({ altura: 320 }));
    const estilo = StyleSheet.flatten(screen.getByTestId("folha-de-notas").props.style);
    expect(estilo).toEqual(expect.objectContaining({ height: 320 }));
  });

  it("soma alça e rodapé e reporta o total como mínimo", async () => {
    // Os dois não são irmãos adjacentes — o miolo fica entre eles —, então
    // não dá para medir o mínimo com um `onLayout` só.
    const aoMedirMinimo = jest.fn();
    await render(elemento({ aoMedirMinimo }));

    await fireEvent(screen.getByTestId("alca-da-folha"), "layout", { nativeEvent: { layout: { height: 44 } } });
    await fireEvent(screen.getByTestId("rodape-da-folha"), "layout", { nativeEvent: { layout: { height: 88 } } });

    expect(aoMedirMinimo).toHaveBeenLastCalledWith(132);
  });

  it("não reporta mínimo enquanto só uma das duas medidas chegou", async () => {
    const aoMedirMinimo = jest.fn();
    await render(elemento({ aoMedirMinimo }));

    await fireEvent(screen.getByTestId("alca-da-folha"), "layout", { nativeEvent: { layout: { height: 44 } } });

    expect(aoMedirMinimo).not.toHaveBeenCalled();
  });

  it("o miolo comprime até sumir, o rodapé não", async () => {
    // É isto que faz o mínimo mostrar só alça + botão: o miolo tem
    // `flex: 1, minHeight: 0` e o rodapé fica fora do que encolhe.
    await render(elemento());
    const miolo = StyleSheet.flatten(screen.getByTestId("miolo-da-folha").props.style);
    expect(miolo).toEqual(expect.objectContaining({ flex: 1, minHeight: 0 }));
  });
});

describe("FolhaDeNotas — toque na alça", () => {
  it("abre até a média quando está no mínimo", async () => {
    const aoArrastar = jest.fn();
    await render(elemento({ altura: 100, aoArrastar }));

    await fireEvent.press(screen.getByTestId("alca-da-folha"));

    expect(aoArrastar).toHaveBeenCalledWith(450);
  });

  it("recolhe para o mínimo quando está aberta", async () => {
    const aoArrastar = jest.fn();
    await render(elemento({ altura: 600, aoArrastar }));

    await fireEvent.press(screen.getByTestId("alca-da-folha"));

    expect(aoArrastar).toHaveBeenCalledWith(100);
  });
});

// O mock oficial de `react-native-reanimated` resolve `withTiming` de forma
// síncrona para o valor final — nenhum quadro intermediário, nenhuma duração
// observável. O valor final de `altura` é idêntico com ou sem animação, então
// o que dá para observar com honestidade é se `withTiming` foi chamado: é
// exatamente o galho que separa "a primeira medida real chegou" (sem animação)
// de "a altura mudou depois" (com animação).
describe("FolhaDeNotas — primeira medida vs. mudança de altura", () => {
  it("aplica a primeira altura real sem chamar withTiming", async () => {
    const espiao = jest.spyOn(Reanimated, "withTiming");
    const resultado = await render(elemento({ altura: 0 }));
    espiao.mockClear();

    // Simula o store recebendo a primeira medida de layout: a altura sai de
    // 0 (nunca medida) para a média real do aparelho. Animar aqui seria uma
    // animação de entrada que o design não pede.
    await resultado.rerender(elemento({ altura: 450 }));

    expect(espiao).not.toHaveBeenCalled();
    espiao.mockRestore();
  });

  it("anima com withTiming quando a altura muda com a folha já medida", async () => {
    const espiao = jest.spyOn(Reanimated, "withTiming");
    const resultado = await render(elemento({ altura: 450 }));
    espiao.mockClear();

    await resultado.rerender(elemento({ altura: 700 }));

    expect(espiao).toHaveBeenCalledTimes(1);
    espiao.mockRestore();
  });
});
