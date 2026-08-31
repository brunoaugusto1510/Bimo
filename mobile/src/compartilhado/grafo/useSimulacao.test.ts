import { act, renderHook } from "@testing-library/react-native";
import type { NoDoGrafo } from "@/dados/tipos";
import { useSimulacao } from "./useSimulacao";

const nos: NoDoGrafo[] = [
  { id: "a", titulo: "A", x: 0.2, y: 0.5, peso: 1 },
  { id: "b", titulo: "B", x: 0.8, y: 0.5, peso: 1 },
];

describe("useSimulacao", () => {
  it("publica uma posição por nó já na montagem", async () => {
    const { result } = await renderHook(() =>
      useSimulacao({ nos, arestas: [{ de: "a", para: "b" }], largura: 400, altura: 800 }),
    );
    expect(result.current.posicoes.value).toHaveLength(2);
    expect(typeof result.current.posicoes.value[0].x).toBe("number");
  });

  it("usa as posições iniciais recebidas em vez do layout circular", async () => {
    const { result } = await renderHook(() =>
      useSimulacao({
        nos,
        arestas: [],
        largura: 400,
        altura: 800,
        posicoesIniciais: { a: { x: 11, y: 22 }, b: { x: 33, y: 44 } },
      }),
    );
    expect(result.current.posicoes.value[0]).toEqual({ x: 11, y: 22 });
  });

  it("ignora posição inicial de nota que não está mais no grafo", async () => {
    const { result } = await renderHook(() =>
      useSimulacao({ nos, arestas: [], largura: 400, altura: 800, posicoesIniciais: { sumiu: { x: 1, y: 2 } } }),
    );
    expect(result.current.posicoes.value).toHaveLength(2);
  });

  it("aguenta vault vazio", async () => {
    // A tela monta antes de `listarNotas` responder, então a lista vazia é o
    // primeiro estado que este hook vê em toda entrada na tela.
    const { result } = await renderHook(() => useSimulacao({ nos: [], arestas: [], largura: 400, altura: 800 }));
    expect(result.current.posicoes.value).toEqual([]);
  });

  it("recria a simulação quando a lista de notas muda", async () => {
    const { result, rerender } = await renderHook(
      (props: { nos: NoDoGrafo[] }) => useSimulacao({ nos: props.nos, arestas: [], largura: 400, altura: 800 }),
      { initialProps: { nos } },
    );

    await rerender({ nos: [...nos, { id: "c", titulo: "C", x: 0.5, y: 0.2, peso: 1 }] });

    expect(result.current.posicoes.value).toHaveLength(3);
  });

  it("soltar um nó que sumiu do grafo não quebra", async () => {
    // Se as notas recarregarem com um nó preso ao dedo, o `onEnd` do gesto
    // ainda vai chamar `soltarNo` com um id que a simulação nova não tem.
    const { result } = await renderHook(() => useSimulacao({ nos, arestas: [], largura: 400, altura: 800 }));
    expect(() => result.current.soltarNo("sumiu")).not.toThrow();
  });

  describe("liga e desliga o loop de quadros", () => {
    // O ciclo do loop foi onde dois bugs passaram: o worklet chamando
    // `setActive` de dentro de si mesmo (capturava `undefined`) e depois o
    // objeto do quadro sendo serializado ao worklet, o que fazia todo
    // `setActive` avisar "Tried to modify key `isActive`". O que dá para
    // afirmar aqui é a ponta ligada — religar depende do resfriamento, que só
    // acontece quando o worklet roda de verdade, e o mock nunca o executa.
    beforeEach(() => {
      (globalThis as { quadrosDeTeste?: unknown[] }).quadrosDeTeste = [];
    });

    it("liga o loop na montagem", async () => {
      await renderHook(() => useSimulacao({ nos, arestas: [], largura: 400, altura: 800 }));
      const quadros = (globalThis as { quadrosDeTeste?: { setActive: jest.Mock }[] }).quadrosDeTeste!;
      expect(quadros[quadros.length - 1].setActive).toHaveBeenCalledWith(true);
    });

    it("pegar e soltar um nó não toca no objeto do quadro", async () => {
      // Estas três funções são worklets. Se alguma citar `quadro`, o objeto é
      // serializado para a UI e todo `setActive` posterior vira aviso do
      // Worklets — foi exatamente o bug. Aqui elas rodam sem que o controle
      // registre chamada nenhuma.
      const { result } = await renderHook(() => useSimulacao({ nos, arestas: [], largura: 400, altura: 800 }));
      const quadros = (globalThis as { quadrosDeTeste?: { setActive: jest.Mock }[] }).quadrosDeTeste!;
      const controle = quadros[quadros.length - 1];
      controle.setActive.mockClear();

      await act(async () => {
        result.current.pegarNo("a", 10, 20);
        result.current.moverNoPego("a", 11, 21);
        result.current.soltarNo("a");
      });

      expect(controle.setActive).not.toHaveBeenCalled();
    });
  });
});
