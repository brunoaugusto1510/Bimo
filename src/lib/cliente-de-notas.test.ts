import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErroDoCliente,
  buscarLigacoes,
  buscarNoConteudo,
  buscarNota,
  buscarPrevia,
  esquecerPrevias,
} from "./cliente-de-notas";

const NOTA = {
  id: "7",
  titulo: "Ler é uma conversa",
  pasta: "Leituras",
  tags: [],
  conteudo: "---\ntags: [a]\n---\n# Ler\n\nUm texto **forte** com [[Outra]].",
  criadoEm: null,
  atualizadoEm: null,
  revisao: 1,
};

function responder(corpo: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo };
}

const fetchFalso = vi.fn();

beforeEach(() => {
  esquecerPrevias();
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buscarNota", () => {
  it("lê /api/notas/<id> com o id escapado e devolve a nota e as capacidades", async () => {
    fetchFalso.mockResolvedValue(responder({ nota: NOTA, capacidades: { escrita: false, datas: false } }));

    const resposta = await buscarNota("a/b c");

    expect(fetchFalso).toHaveBeenCalledWith("/api/notas/a%2Fb%20c", expect.anything());
    expect(resposta.nota.titulo).toBe("Ler é uma conversa");
    expect(resposta.capacidades.escrita).toBe(false);
  });

  it("transforma uma recusa do servidor em um erro com a mensagem dele e o status", async () => {
    fetchFalso.mockResolvedValue(responder({ erro: "Nota não encontrada." }, 404));

    await expect(buscarNota("9")).rejects.toMatchObject({ message: "Nota não encontrada.", status: 404 });
  });

  it("sessão expirada (401) avisa para entrar de novo", async () => {
    fetchFalso.mockResolvedValue(responder({ erro: "Sessão inválida ou expirada." }, 401));

    const erro = await buscarNota("9").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDoCliente);
    expect((erro as ErroDoCliente).status).toBe(401);
  });

  it("falha de rede vira uma mensagem em português, sem status", async () => {
    fetchFalso.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(buscarNota("9")).rejects.toMatchObject({
      message: "Não consegui falar com o servidor.",
      status: undefined,
    });
  });

  it("uma resposta que não é JSON ainda vira um erro legível", async () => {
    fetchFalso.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("inesperado");
      },
    });

    await expect(buscarNota("9")).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/tente de novo/i) });
  });

  it("repassa o sinal de cancelamento", async () => {
    fetchFalso.mockResolvedValue(responder({ nota: NOTA, capacidades: { escrita: true, datas: true } }));
    const controle = new AbortController();

    await buscarNota("7", controle.signal);

    expect(fetchFalso.mock.calls[0][1]).toMatchObject({ signal: controle.signal });
  });

  it("um cancelamento não vira mensagem de erro de rede: o AbortError passa como está", async () => {
    const aborto = new DOMException("cancelado", "AbortError");
    fetchFalso.mockRejectedValue(aborto);

    await expect(buscarNota("7")).rejects.toBe(aborto);
  });
});

describe("buscarLigacoes e buscarNoConteudo", () => {
  it("lê as ligações de uma nota", async () => {
    fetchFalso.mockResolvedValue(responder({ ligacoes: { saida: [], entrada: [] }, mencoesSemLigacao: [] }));

    const resposta = await buscarLigacoes("7");

    expect(fetchFalso).toHaveBeenCalledWith("/api/notas/7/ligacoes", expect.anything());
    expect(resposta.mencoesSemLigacao).toEqual([]);
  });

  it("busca no conteúdo escapando a consulta e devolve só a lista", async () => {
    fetchFalso.mockResolvedValue(responder({ resultados: [{ id: "7", titulo: "A", pasta: null, trecho: "x" }] }));

    const resultados = await buscarNoConteudo("redes & dns", 5);

    expect(fetchFalso).toHaveBeenCalledWith("/api/notas/busca?q=redes%20%26%20dns&limite=5", expect.anything());
    expect(resultados).toHaveLength(1);
  });
});

describe("buscarPrevia", () => {
  it("devolve título, pasta e um trecho sem a sintaxe do Markdown", async () => {
    fetchFalso.mockResolvedValue(responder({ nota: NOTA, capacidades: { escrita: true, datas: true } }));

    const previa = await buscarPrevia("7");

    expect(previa).toEqual({
      titulo: "Ler é uma conversa",
      pasta: "Leituras",
      trecho: "Ler Um texto forte com Outra.",
    });
  });

  it("guarda o resultado: a mesma nota não é pedida duas vezes", async () => {
    fetchFalso.mockResolvedValue(responder({ nota: NOTA, capacidades: { escrita: true, datas: true } }));

    await buscarPrevia("7");
    await buscarPrevia("7");

    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("pedidos simultâneos da mesma nota compartilham uma só requisição", async () => {
    fetchFalso.mockResolvedValue(responder({ nota: NOTA, capacidades: { escrita: true, datas: true } }));

    await Promise.all([buscarPrevia("7"), buscarPrevia("7")]);

    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("uma falha vira null e não fica guardada: a próxima tentativa pede de novo", async () => {
    fetchFalso.mockRejectedValueOnce(new TypeError("rede"));
    fetchFalso.mockResolvedValueOnce(responder({ nota: NOTA, capacidades: { escrita: true, datas: true } }));

    expect(await buscarPrevia("7")).toBeNull();
    expect(await buscarPrevia("7")).not.toBeNull();
  });
});
