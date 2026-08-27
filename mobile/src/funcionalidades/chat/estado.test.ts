import { useEstadoChat } from "./estado";
import type { ServicoIA } from "@/servicos";
import { notas } from "@/dados/fixtures/notas";

const iaDublê: ServicoIA = {
  conversar: async () => ({ texto: "Encontrei 2 notas.", cartoes: [notas[0].id, notas[1].id] }),
  acaoNaNota: async () => ({ tipo: "resumo", rotulo: "Resumir a nota", texto: "resumo" }),
};

describe("useEstadoChat", () => {
  beforeEach(() => useEstadoChat.setState({ mensagens: [], rascunho: "", digitando: false }));

  it("guarda o rascunho", () => {
    useEstadoChat.getState().definirRascunho("o que escrevi sobre notas?");
    expect(useEstadoChat.getState().rascunho).toBe("o que escrevi sobre notas?");
  });

  it("ignora enviar com rascunho vazio", async () => {
    useEstadoChat.getState().definirRascunho("   ");
    await useEstadoChat.getState().enviar(iaDublê, jest.fn());
    expect(useEstadoChat.getState().mensagens).toHaveLength(0);
  });

  it("acrescenta a bolha do usuário e limpa o rascunho na hora", async () => {
    useEstadoChat.getState().definirRascunho("oi");
    const promessa = useEstadoChat.getState().enviar(iaDublê, jest.fn());
    expect(useEstadoChat.getState().mensagens[0].autor).toBe("usuario");
    expect(useEstadoChat.getState().rascunho).toBe("");
    expect(useEstadoChat.getState().digitando).toBe(true);
    await promessa;
  });

  it("acrescenta a resposta do agente com cartões e desliga o digitando", async () => {
    useEstadoChat.getState().definirRascunho("oi");
    await useEstadoChat.getState().enviar(iaDublê, jest.fn());
    const [, resposta] = useEstadoChat.getState().mensagens;
    expect(resposta.autor).toBe("agente");
    expect(resposta.cartoes).toEqual([notas[0].id, notas[1].id]);
    expect(useEstadoChat.getState().digitando).toBe(false);
  });

  it("pulsa o grafo duas vezes: ao enviar e ao responder", async () => {
    const aoPulsar = jest.fn();
    useEstadoChat.getState().definirRascunho("oi");
    await useEstadoChat.getState().enviar(iaDublê, aoPulsar);
    expect(aoPulsar).toHaveBeenCalledTimes(2);
  });

  it("preenche o rascunho com a pergunta sobre um nó", () => {
    useEstadoChat.getState().preencherRascunho("Notas atômicas");
    expect(useEstadoChat.getState().rascunho).toBe("O que eu já escrevi sobre 'Notas atômicas'?");
  });

  it("mostra o erro como mensagem do agente quando o serviço falha", async () => {
    const iaQuebrada: ServicoIA = {
      conversar: async () => { throw new Error("sem rede"); },
      acaoNaNota: iaDublê.acaoNaNota,
    };
    useEstadoChat.getState().definirRascunho("oi");
    await useEstadoChat.getState().enviar(iaQuebrada, jest.fn());
    const [, resposta] = useEstadoChat.getState().mensagens;
    expect(resposta.autor).toBe("agente");
    expect(resposta.texto).toContain("Não consegui");
    expect(useEstadoChat.getState().digitando).toBe(false);
  });
});
