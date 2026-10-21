import { describe, expect, it, vi } from "vitest";
import { lerRespostaDoChat, passoDoRastro, type LinhaDePasso } from "./fluxo-do-chat";

/** Uma resposta NDJSON entregue em pedaços arbitrários — inclusive cortando uma linha no meio. */
function respostaEmFluxo(pedacos: string[], status = 200): Response {
  const codificador = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    start(controle) {
      for (const pedaco of pedacos) controle.enqueue(codificador.encode(pedaco));
      controle.close();
    },
  });
  return new Response(corpo, { status, headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}

const passo = (extra: Partial<LinhaDePasso> = {}): LinhaDePasso => ({
  tipo: "passo",
  nome: "ler_nota",
  resumo: 'Leu "Redes/TCP"',
  erro: false,
  ids: ["n1"],
  argumentos: { caminho: "Redes/TCP" },
  ...extra,
});

describe("lerRespostaDoChat", () => {
  it("repassa cada passo na ordem e devolve a resposta final", async () => {
    const linhas = [
      JSON.stringify(passo({ nome: "buscar_notas", ids: ["n1", "n2"], resumo: 'Buscou "tcp" — 2 nota(s)' })),
      JSON.stringify(passo()),
      JSON.stringify({ tipo: "resposta", resposta: "Pronto.", ferramentas: [] }),
    ].join("\n");
    const aoPasso = vi.fn();

    const resultado = await lerRespostaDoChat(respostaEmFluxo([linhas.slice(0, 40), linhas.slice(40)]), aoPasso);

    expect(aoPasso.mock.calls.map(([linha]) => linha.nome)).toEqual(["buscar_notas", "ler_nota"]);
    expect(resultado).toEqual({ resposta: "Pronto.", ferramentas: [] });
  });

  it("ignora linhas vazias e linhas que não são JSON", async () => {
    const corpo = `\n${JSON.stringify(passo())}\nnão é json\n\n${JSON.stringify({ tipo: "resposta", resposta: "Ok", ferramentas: [] })}\n`;
    const aoPasso = vi.fn();

    const resultado = await lerRespostaDoChat(respostaEmFluxo([corpo]), aoPasso);

    expect(aoPasso).toHaveBeenCalledTimes(1);
    expect(resultado.resposta).toBe("Ok");
  });

  it("transforma a linha de erro numa exceção com a mensagem do servidor", async () => {
    const corpo = `${JSON.stringify(passo())}\n${JSON.stringify({ tipo: "erro", erro: "Não consegui responder agora. Tente de novo." })}\n`;

    await expect(lerRespostaDoChat(respostaEmFluxo([corpo]))).rejects.toThrow("Não consegui responder agora. Tente de novo.");
  });

  it("acusa interrupção quando o fluxo acaba sem resposta", async () => {
    await expect(lerRespostaDoChat(respostaEmFluxo([JSON.stringify(passo())]))).rejects.toThrow(/interrompida/);
  });

  it("aceita a resposta JSON de sempre (sem fluxo)", async () => {
    const resposta = { ok: true, json: async () => ({ resposta: "Oi", ferramentas: [] }) };

    await expect(lerRespostaDoChat(resposta)).resolves.toEqual({ resposta: "Oi", ferramentas: [] });
  });

  it("usa o erro do corpo JSON quando o servidor recusa antes do fluxo", async () => {
    const resposta = new Response(JSON.stringify({ erro: "Sessão expirada." }), { status: 401, headers: { "Content-Type": "application/json" } });

    await expect(lerRespostaDoChat(resposta)).rejects.toThrow("Sessão expirada.");
  });

  it("um passo que derruba o ouvinte não interrompe a leitura", async () => {
    const corpo = `${JSON.stringify(passo())}\n${JSON.stringify({ tipo: "resposta", resposta: "Ok", ferramentas: [] })}\n`;
    const aoPasso = vi.fn(() => { throw new Error("falha no ouvinte"); });

    await expect(lerRespostaDoChat(respostaEmFluxo([corpo]), aoPasso)).resolves.toMatchObject({ resposta: "Ok" });
  });
});

describe("passoDoRastro", () => {
  it("busca vira busca com os ids na ordem", () => {
    expect(passoDoRastro(passo({ nome: "buscar_notas", ids: ["a", "b"] }))).toEqual({ tipo: "busca", ids: ["a", "b"] });
  });

  it("leitura, criação e edição apontam para a nota tocada", () => {
    expect(passoDoRastro(passo({ ids: ["a"] }))).toEqual({ tipo: "leitura", id: "a" });
    expect(passoDoRastro(passo({ nome: "criar_nota", ids: [], notaId: "nova" }))).toEqual({ tipo: "escrita", id: "nova", criada: true });
    expect(passoDoRastro(passo({ nome: "editar_nota", ids: ["a"] }))).toEqual({ tipo: "escrita", id: "a", criada: false });
  });

  it("passos com erro, sem nota ou de outras ferramentas não entram no rastro", () => {
    expect(passoDoRastro(passo({ erro: true }))).toBeNull();
    expect(passoDoRastro(passo({ ids: [] }))).toBeNull();
    expect(passoDoRastro(passo({ nome: "listar_notas", ids: [] }))).toBeNull();
  });

  it("descarta ids que não são texto", () => {
    expect(passoDoRastro(passo({ nome: "buscar_notas", ids: ["a", 3 as unknown as string, ""] }))).toEqual({ tipo: "busca", ids: ["a"] });
  });
});
