import { useEstadoEditor } from "./estado";
import { notas } from "@/dados/fixtures/notas";
import type { ServicoIA } from "@/servicos";

const ia: ServicoIA = {
  conversar: async () => ({ texto: "", cartoes: [] }),
  acaoNaNota: async (tipo) =>
    tipo === "tags"
      ? { tipo, rotulo: "Extrair tags", texto: "Três tags:", tags: ["#novo", ...notas[0].tags] }
      : { tipo, rotulo: "Sugerir links", texto: "Texto sugerido." },
};

describe("useEstadoEditor", () => {
  beforeEach(() => {
    // Hygiene de teste: sem isso, `carregar()` guardando `idCarregado` entre
    // chamadas (a correção da corrida abaixo) faria um `it` que deixou
    // `sugestao`/`menuIA` sujos vazar para o próximo — carregar(notas[0])
    // de novo veria "mesmo id" e pularia a limpeza. `resetar()` zera tudo,
    // inclusive `idCarregado`, antes de cada teste carregar a nota de novo.
    useEstadoEditor.getState().resetar();
    useEstadoEditor.getState().carregar(notas[0]);
  });

  it("carrega título, corpo e tags da nota", () => {
    const estado = useEstadoEditor.getState();
    expect(estado.titulo).toBe(notas[0].titulo);
    expect(estado.texto).toBe(notas[0].corpo);
    expect(estado.tags).toEqual(notas[0].tags);
  });

  it("acende um nó novo a cada 18 caracteres digitados", () => {
    const aoCrescer = jest.fn();
    const base = notas[0].corpo;
    useEstadoEditor.getState().digitarTexto(base + "a".repeat(17), aoCrescer);
    expect(aoCrescer).not.toHaveBeenCalled();
    useEstadoEditor.getState().digitarTexto(base + "a".repeat(18), aoCrescer);
    expect(aoCrescer).toHaveBeenCalledTimes(1);
  });

  it("guarda a sugestão, fecha o menu e pulsa o grafo ao rodar uma ação", async () => {
    const aoPulsar = jest.fn();
    useEstadoEditor.setState({ menuIA: true });
    await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], aoPulsar);
    expect(useEstadoEditor.getState().sugestao?.tipo).toBe("links");
    expect(useEstadoEditor.getState().menuIA).toBe(false);
    expect(aoPulsar).toHaveBeenCalledTimes(1);
  });

  it("anexa o texto da sugestão ao corpo e acende um nó", async () => {
    const aoCrescer = jest.fn();
    await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], jest.fn());
    useEstadoEditor.getState().inserirSugestao(aoCrescer);
    expect(useEstadoEditor.getState().texto).toContain("Texto sugerido.");
    expect(useEstadoEditor.getState().sugestao).toBeNull();
    expect(aoCrescer).toHaveBeenCalledTimes(1);
  });

  it("mescla as tags sem duplicar", async () => {
    await useEstadoEditor.getState().rodarAcao(ia, "tags", notas[0], jest.fn());
    useEstadoEditor.getState().inserirSugestao(jest.fn());
    const tags = useEstadoEditor.getState().tags;
    expect(tags).toContain("#novo");
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("descartar fecha o cartão sem mexer no corpo", async () => {
    await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], jest.fn());
    const antes = useEstadoEditor.getState().texto;
    useEstadoEditor.getState().descartarSugestao();
    expect(useEstadoEditor.getState().sugestao).toBeNull();
    expect(useEstadoEditor.getState().texto).toBe(antes);
  });

  describe("corrida entre o carregamento da nota e uma ação rápida da IA", () => {
    // Reproduz o que a Editor.tsx faz de verdade: chama carregar() de forma
    // síncrona com um "casco" (só o id) assim que a rota abre — antes de
    // `vault.obterNota` sequer ter sido chamado — e chama carregar() de
    // novo quando o fetch, mais lento, finalmente resolve. Entre as duas
    // chamadas, o usuário roda uma ação da IA. A sugestão que isso produz
    // não pode ser apagada quando a segunda chamada chega com o conteúdo
    // real da nota.
    it("preserva a sugestão quando o carregamento da nota termina depois de uma ação do usuário", async () => {
      useEstadoEditor.getState().resetar();

      // 1) a rota abre: carregar() síncrono com só o id, antes do fetch.
      useEstadoEditor.getState().carregar({ ...notas[0], titulo: "", corpo: "", tags: [] });

      // 2) o usuário roda uma ação da IA antes do fetch responder.
      await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], jest.fn());
      expect(useEstadoEditor.getState().sugestao?.tipo).toBe("links");

      // 3) só agora o fetch (mais lento) chega com o conteúdo real.
      useEstadoEditor.getState().carregar(notas[0]);

      // a sugestão que chegou durante a espera sobrevive, e o conteúdo real
      // da nota é aplicado normalmente.
      expect(useEstadoEditor.getState().sugestao?.tipo).toBe("links");
      expect(useEstadoEditor.getState().titulo).toBe(notas[0].titulo);
      expect(useEstadoEditor.getState().texto).toBe(notas[0].corpo);
    });

    it("mesmo assim zera a sugestão ao trocar para uma nota diferente", async () => {
      useEstadoEditor.getState().resetar();
      useEstadoEditor.getState().carregar(notas[0]);
      await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], jest.fn());
      expect(useEstadoEditor.getState().sugestao).not.toBeNull();

      useEstadoEditor.getState().carregar(notas[1]);

      expect(useEstadoEditor.getState().sugestao).toBeNull();
      expect(useEstadoEditor.getState().titulo).toBe(notas[1].titulo);
    });
  });
});
