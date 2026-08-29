import { render } from "@testing-library/react-native";
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
    passo: 1,
    aoAvancarPasso: jest.fn(),
    alturaDisponivel: 0,
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

// O mock oficial de `react-native-reanimated` (node_modules/react-native-reanimated/mock.js)
// resolve `withTiming` de forma síncrona para o valor final — nenhum quadro
// intermediário, nenhuma duração observável. Isso significa que o valor
// final de `altura` é idêntico com ou sem animação: não dá para diferenciar
// os dois casos observando o resultado (ex.: o `height` do estilo depois da
// atualização). O que dá para observar com honestidade é se `withTiming`
// foi chamado — é exatamente o galho de código que separa "layout real
// chegou" (sem animação) de "passo mudou" (com animação). Por isso os dois
// testes abaixo espiam `withTiming` em vez de inspecionar o valor de altura.
describe("FolhaDeNotas — altura vinda de onLayout vs. troca de passo", () => {
  it("aplica a altura do primeiro onLayout real sem chamar withTiming", async () => {
    const espiao = jest.spyOn(Reanimated, "withTiming");
    const resultado = await render(elemento({ alturaDisponivel: 0, passo: 1 }));
    espiao.mockClear(); // descarta qualquer chamada do próprio mount, se houver

    // Simula o `onLayout` real chegando: alturaDisponivel sai de 0 (o
    // fallback ALTURA_DE_RESERVA) para uma altura real de aparelho.
    await resultado.rerender(elemento({ alturaDisponivel: 640, passo: 1 }));

    expect(espiao).not.toHaveBeenCalled();
    espiao.mockRestore();
  });

  it("anima com withTiming ao trocar o passo com a altura já conhecida", async () => {
    const espiao = jest.spyOn(Reanimated, "withTiming");
    const resultado = await render(elemento({ alturaDisponivel: 640, passo: 1 }));
    espiao.mockClear();

    await resultado.rerender(elemento({ alturaDisponivel: 640, passo: 2 }));

    expect(espiao).toHaveBeenCalledTimes(1);
    espiao.mockRestore();
  });
});
