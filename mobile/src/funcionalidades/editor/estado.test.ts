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
    // Hygiene de teste: sem isso, a store — singleton de módulo — vazaria
    // `sugestao`/`menuIA`/`tokenDeCarregamento` de um `it` para o próximo.
    // `resetar()` zera tudo antes de reproduzir o fluxo real da Editor.tsx:
    // abrirNota() (síncrono) seguido de aplicarConteudo() (quando o fetch
    // "resolve").
    useEstadoEditor.getState().resetar();
    const token = useEstadoEditor.getState().abrirNota(notas[0].id);
    useEstadoEditor.getState().aplicarConteudo(notas[0], token);
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
    // Reproduz o que a Editor.tsx faz de verdade: abrirNota() de forma
    // síncrona (guarda o token) assim que a rota abre — antes de
    // `vault.obterNota` sequer ter sido chamado — e aplicarConteudo() de
    // novo quando o fetch, mais lento, finalmente resolve com esse mesmo
    // token. Entre as duas chamadas, o usuário roda uma ação da IA. A
    // sugestão que isso produz não pode ser apagada quando o conteúdo real
    // da nota chega.
    it("preserva a sugestão quando o carregamento da nota termina depois de uma ação do usuário", async () => {
      useEstadoEditor.getState().resetar();
      const token = useEstadoEditor.getState().abrirNota(notas[0].id);

      await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], jest.fn());
      expect(useEstadoEditor.getState().sugestao?.tipo).toBe("links");

      useEstadoEditor.getState().aplicarConteudo(notas[0], token);

      expect(useEstadoEditor.getState().sugestao?.tipo).toBe("links");
      expect(useEstadoEditor.getState().titulo).toBe(notas[0].titulo);
      expect(useEstadoEditor.getState().texto).toBe(notas[0].corpo);
    });

    // Fix round 1 só protegia sugestão/menu — título, corpo e tags
    // continuavam sendo sobrescritos incondicionalmente por aplicarConteudo,
    // mesmo que o usuário já tivesse começado a digitar. Os TextInput estão
    // interativos desde o primeiro paint, igual ao botão Bimo. A proteção é
    // campo a campo: só `texto` foi tocado aqui, então `titulo` (que o
    // usuário não mexeu) chega normalmente do conteúdo real da nota.
    it("preserva o texto digitado quando o carregamento da nota termina depois", () => {
      useEstadoEditor.getState().resetar();
      const token = useEstadoEditor.getState().abrirNota(notas[0].id);

      useEstadoEditor.getState().digitarTexto("Rascunho do usuário, ainda não salvo", jest.fn());

      useEstadoEditor.getState().aplicarConteudo(notas[0], token);

      expect(useEstadoEditor.getState().texto).toBe("Rascunho do usuário, ainda não salvo");
      expect(useEstadoEditor.getState().titulo).toBe(notas[0].titulo);
    });

    it("abrirNota descarta a sugestão da nota anterior ao trocar para uma nota diferente", async () => {
      useEstadoEditor.getState().resetar();
      useEstadoEditor.getState().abrirNota(notas[0].id);
      await useEstadoEditor.getState().rodarAcao(ia, "links", notas[0], jest.fn());
      expect(useEstadoEditor.getState().sugestao).not.toBeNull();

      useEstadoEditor.getState().abrirNota(notas[1].id);

      expect(useEstadoEditor.getState().sugestao).toBeNull();
    });

    // Fix round 1 comparava o id recebido contra `idCarregado` NO MOMENTO em
    // que a promise resolvia — mas isso não distingue "esta é a busca atual"
    // de "esta é uma busca obsoleta que foi superada": abrir a nota A,
    // voltar antes do fetch responder e abrir a nota B faz `idCarregado`
    // virar "B" antes do fetch de A chegar. Quando ele finalmente chega,
    // comparar só o id (A !== B) já bloqueava a troca de sugestão/menu, mas
    // a v1 aplicava título/corpo/tags de A mesmo assim, corrompendo a tela
    // que já mostra B. `tokenDeCarregamento` — incrementado a cada
    // abrirNota(), comparado no momento em que a promise resolve — resolve
    // isso sem depender de comparar strings de id.
    it("descarta uma resposta obsoleta de A quando a nota B já foi aberta antes dela chegar", () => {
      useEstadoEditor.getState().resetar();
      const tokenA = useEstadoEditor.getState().abrirNota(notas[0].id);

      // o usuário fecha A e abre B antes do fetch de A responder
      useEstadoEditor.getState().abrirNota(notas[1].id);

      // o fetch de A, mais lento, só chega agora — com o token antigo
      useEstadoEditor.getState().aplicarConteudo(notas[0], tokenA);

      // o conteúdo de A não pode vazar para a tela que já mostra B
      expect(useEstadoEditor.getState().idCarregado).toBe(notas[1].id);
      expect(useEstadoEditor.getState().titulo).toBe("");
      expect(useEstadoEditor.getState().titulo).not.toBe(notas[0].titulo);
    });

    // O teste acima (A -> B, ids diferentes) já seria pego só de corrigir a
    // checagem de id de round 1 (id diferente vira "descarta", não "troca e
    // aplica") — não prova, sozinho, que era preciso um token. O caso que
    // SÓ o token resolve é reabrir a MESMA nota rápido o bastante para duas
    // buscas do mesmo id ficarem em voo ao mesmo tempo: comparar id não
    // distingue qual das duas é a mais nova, porque as duas têm o mesmo id.
    it("descarta uma resposta obsoleta quando a MESMA nota foi reaberta antes dela responder", () => {
      useEstadoEditor.getState().resetar();
      const tokenAntigo = useEstadoEditor.getState().abrirNota(notas[0].id);
      // o usuário fecha e reabre a mesma nota antes da primeira busca
      // responder — uma segunda busca para o MESMO id fica em voo também.
      const tokenNovo = useEstadoEditor.getState().abrirNota(notas[0].id);

      // a busca mais nova responde primeiro, como seria de esperar.
      useEstadoEditor.getState().aplicarConteudo(notas[0], tokenNovo);
      expect(useEstadoEditor.getState().titulo).toBe(notas[0].titulo);

      // a busca ANTIGA — mesmo id, token superado — só responde agora. O
      // usuário não tocou em nada, então só o token (não o campo-a-campo do
      // teste anterior, e não o id, que é idêntico nas duas buscas) pode
      // saber que esta resposta já foi superada.
      const versaoObsoleta = { ...notas[0], titulo: "Versão obsoleta do título" };
      useEstadoEditor.getState().aplicarConteudo(versaoObsoleta, tokenAntigo);

      expect(useEstadoEditor.getState().titulo).toBe(notas[0].titulo);
    });
  });
});
