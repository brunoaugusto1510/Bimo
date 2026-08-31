import { VERSAO_DO_LAYOUT, reconciliarLayout, type LayoutPersistido } from "./layoutPersistido";

function salvo(sobrescritas: Partial<LayoutPersistido> = {}): LayoutPersistido {
  return {
    versao: VERSAO_DO_LAYOUT,
    posicoes: { a: { x: 10, y: 20 }, b: { x: 30, y: 40 } },
    zoom: 1,
    deslocamentoX: 0,
    deslocamentoY: 0,
    alturaDaFolha: 400,
    ...sobrescritas,
  };
}

describe("reconciliarLayout", () => {
  it("mantém a posição de nota conhecida", () => {
    expect(reconciliarLayout(salvo(), ["a"])).toEqual({ a: { x: 10, y: 20 } });
  });

  it("não inventa posição para nota nova", () => {
    // Sem entrada, o useSimulacao cai no layout circular de montarGrafo.
    expect(reconciliarLayout(salvo(), ["a", "nova"])).toEqual({ a: { x: 10, y: 20 } });
  });

  it("descarta posição órfã de nota que sumiu do vault", () => {
    expect(reconciliarLayout(salvo(), ["a"])).not.toHaveProperty("b");
  });

  it("descarta tudo quando a versão não bate", () => {
    // É cache de conveniência, não dado do usuário: descartar sai mais barato
    // e mais seguro que migrar.
    expect(reconciliarLayout(salvo({ versao: VERSAO_DO_LAYOUT - 1 }), ["a"])).toEqual({});
  });

  it("aguenta não ter nada salvo", () => {
    expect(reconciliarLayout(null, ["a"])).toEqual({});
  });

  it("aguenta um registro salvo sem o campo de posições", () => {
    // Leitura corrompida do disco: cai no layout padrão em vez de derrubar a
    // tela, seguindo o padrão de erro do repositório.
    expect(reconciliarLayout({ ...salvo(), posicoes: undefined as never }, ["a"])).toEqual({});
  });
});
