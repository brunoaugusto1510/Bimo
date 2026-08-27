import { useEstadoVault } from "./estado";

describe("useEstadoVault", () => {
  beforeEach(() => useEstadoVault.setState({ busca: "", noSelecionado: null, passoDaFolha: 1 }));

  it("guarda a busca", () => {
    useEstadoVault.getState().definirBusca("atômica");
    expect(useEstadoVault.getState().busca).toBe("atômica");
  });

  it("sobe a folha ao menos ao passo 1 ao selecionar um nó", () => {
    useEstadoVault.setState({ passoDaFolha: 0 });
    useEstadoVault.getState().selecionarNo("a");
    expect(useEstadoVault.getState().noSelecionado).toBe("a");
    expect(useEstadoVault.getState().passoDaFolha).toBe(1);
  });

  it("não abaixa a folha que já estava no passo 2", () => {
    useEstadoVault.setState({ passoDaFolha: 2 });
    useEstadoVault.getState().selecionarNo("a");
    expect(useEstadoVault.getState().passoDaFolha).toBe(2);
  });

  it("limpa a seleção", () => {
    useEstadoVault.getState().selecionarNo("a");
    useEstadoVault.getState().limparSelecao();
    expect(useEstadoVault.getState().noSelecionado).toBeNull();
  });

  it("cicla os três passos da folha", () => {
    useEstadoVault.setState({ passoDaFolha: 0 });
    useEstadoVault.getState().avancarPasso();
    expect(useEstadoVault.getState().passoDaFolha).toBe(1);
    useEstadoVault.getState().avancarPasso();
    expect(useEstadoVault.getState().passoDaFolha).toBe(2);
    useEstadoVault.getState().avancarPasso();
    expect(useEstadoVault.getState().passoDaFolha).toBe(0);
  });
});
