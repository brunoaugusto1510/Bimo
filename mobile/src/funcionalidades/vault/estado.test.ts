import { useEstadoVault } from "./estado";

describe("useEstadoVault", () => {
  beforeEach(() =>
    useEstadoVault.setState({
      busca: "",
      noSelecionado: null,
      alturaDaFolha: 0,
      alturaMinima: 0,
      alturaMaxima: 0,
    }),
  );

  it("guarda a busca", () => {
    useEstadoVault.getState().definirBusca("atômica");
    expect(useEstadoVault.getState().busca).toBe("atômica");
  });

  it("limpa a seleção", () => {
    useEstadoVault.getState().selecionarNo("a");
    useEstadoVault.getState().limparSelecao();
    expect(useEstadoVault.getState().noSelecionado).toBeNull();
  });

  describe("altura da folha", () => {
    it("guarda a altura definida pelo arrasto", () => {
      useEstadoVault.getState().definirAlturaDaFolha(420);
      expect(useEstadoVault.getState().alturaDaFolha).toBe(420);
    });

    it("ao receber os limites pela primeira vez, abre na altura média", () => {
      // A folha nasce sem medida (0). Quando o layout real chega, ela precisa
      // de uma altura utilizável — abrir no mínimo esconderia a lista inteira
      // logo na entrada da tela.
      useEstadoVault.getState().definirLimitesDaFolha(100, 800);
      expect(useEstadoVault.getState().alturaDaFolha).toBe(450);
    });

    it("ao receber limites de novo, reclampa sem descartar a altura escolhida", () => {
      useEstadoVault.getState().definirLimitesDaFolha(100, 800);
      useEstadoVault.getState().definirAlturaDaFolha(700);
      useEstadoVault.getState().definirLimitesDaFolha(100, 500);
      expect(useEstadoVault.getState().alturaDaFolha).toBe(500);
    });

    it("selecionar um nó sobe a bandeja até a média quando ela está mais baixa", () => {
      useEstadoVault.getState().definirLimitesDaFolha(100, 800);
      useEstadoVault.getState().definirAlturaDaFolha(120);
      useEstadoVault.getState().selecionarNo("a");
      expect(useEstadoVault.getState().noSelecionado).toBe("a");
      expect(useEstadoVault.getState().alturaDaFolha).toBe(450);
    });

    it("selecionar um nó não abaixa a bandeja que já está alta", () => {
      useEstadoVault.getState().definirLimitesDaFolha(100, 800);
      useEstadoVault.getState().definirAlturaDaFolha(760);
      useEstadoVault.getState().selecionarNo("a");
      expect(useEstadoVault.getState().alturaDaFolha).toBe(760);
    });

    it("limpar a seleção não mexe na altura", () => {
      useEstadoVault.getState().definirLimitesDaFolha(100, 800);
      useEstadoVault.getState().definirAlturaDaFolha(300);
      useEstadoVault.getState().selecionarNo(null);
      expect(useEstadoVault.getState().alturaDaFolha).toBe(300);
    });
  });
});
