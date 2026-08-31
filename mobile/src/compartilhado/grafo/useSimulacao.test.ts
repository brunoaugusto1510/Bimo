import { renderHook } from "@testing-library/react-native";
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
});
