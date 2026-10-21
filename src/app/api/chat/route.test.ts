import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agente", () => ({
  responder: vi.fn(),
}));

import { responder, type PassoDoServidor } from "@/lib/agente";
import { ErroDeConfiguracao } from "@/lib/repositorio-de-notas/config";
import { NOME_DO_COOKIE, criarTokenDeSessao } from "@/lib/sessao";
import { POST } from "./route";

const SEGREDO = "um-segredo-de-testes-com-mais-de-32-caracteres";

/** A rota exige sessão, então todo pedido de teste já vai com cookie válido. */
function cookieValido(): string {
  return `${NOME_DO_COOKIE}=${criarTokenDeSessao()}`;
}

function requisicao(corpo: unknown, autenticado = true): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(autenticado ? { cookie: cookieValido() } : {}),
    },
    body: JSON.stringify(corpo),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SEGREDO_SESSAO = SEGREDO;
  vi.stubEnv("GEMINI_API_KEY", "teste");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.SEGREDO_SESSAO;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("chama responder() com o histórico e devolve 200 com o resultado", async () => {
    vi.mocked(responder).mockResolvedValue({ resposta: "Oi!", ferramentas: [] });

    const res = await POST(
      requisicao({ mensagens: [{ papel: "usuario", conteudo: "Olá" }] }),
    );

    expect(res.status).toBe(200);
    expect(responder).toHaveBeenCalledWith([{ papel: "usuario", conteudo: "Olá" }]);
    await expect(res.json()).resolves.toEqual({ resposta: "Oi!", ferramentas: [] });
  });

  it("devolve 400 quando o corpo não é JSON válido", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: cookieValido() },
      body: "isso não é json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(responder).not.toHaveBeenCalled();
  });

  it("devolve 400 quando 'mensagens' está ausente", async () => {
    const res = await POST(requisicao({}));
    expect(res.status).toBe(400);
    expect(responder).not.toHaveBeenCalled();
  });

  it("devolve 400 quando 'mensagens' é um array vazio", async () => {
    const res = await POST(requisicao({ mensagens: [] }));
    expect(res.status).toBe(400);
  });

  it("devolve 400 quando uma mensagem tem 'papel' inválido", async () => {
    const res = await POST(
      requisicao({ mensagens: [{ papel: "sistema", conteudo: "oi" }] }),
    );
    expect(res.status).toBe(400);
    expect(responder).not.toHaveBeenCalled();
  });

  it("devolve 400 quando 'conteudo' está vazio", async () => {
    const res = await POST(
      requisicao({ mensagens: [{ papel: "usuario", conteudo: "   " }] }),
    );
    expect(res.status).toBe(400);
  });

  it("devolve 500 genérico quando responder() lança exceção", async () => {
    vi.mocked(responder).mockRejectedValue(
      new Error("GEMINI_API_KEY não está definida."),
    );

    const res = await POST(
      requisicao({ mensagens: [{ papel: "usuario", conteudo: "oi" }] }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      erro: "Não consegui responder agora. Tente de novo.",
    });
  });

  it("recusa outra origem antes de chamar o agente", async () => {
    const pedido = requisicao({ mensagens: [{ papel: "usuario", conteudo: "oi" }] });
    pedido.headers.set("origin", "http://outro");
    expect((await POST(pedido)).status).toBe(403);
    expect(responder).not.toHaveBeenCalled();
  });

  it("recusa configuração ausente com 503 genérico", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const resposta = await POST(requisicao({ mensagens: [{ papel: "usuario", conteudo: "oi" }] }));
    expect(resposta.status).toBe(503);
    expect(JSON.stringify(await resposta.json())).not.toContain("GEMINI_API_KEY");
    expect(responder).not.toHaveBeenCalled();
  });

  /*
   * A rota já é protegida pelo `proxy.ts`, mas ela também confere por conta
   * própria — então estes casos garantem que a segunda tranca funciona mesmo se
   * o `matcher` do proxy mudar.
   */
  it("devolve 401 e não chama o agente quando não há cookie de sessão", async () => {
    const res = await POST(
      requisicao({ mensagens: [{ papel: "usuario", conteudo: "oi" }] }, false),
    );

    expect(res.status).toBe(401);
    expect(responder).not.toHaveBeenCalled();
  });

  it("devolve 401 e não chama o agente quando o cookie está adulterado", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${NOME_DO_COOKIE}=9999999999999.assinatura-inventada`,
      },
      body: JSON.stringify({ mensagens: [{ papel: "usuario", conteudo: "oi" }] }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(responder).not.toHaveBeenCalled();
  });

  it("recusa antes de validar o corpo, para não vazar o formato esperado", async () => {
    const res = await POST(requisicao({ mensagens: [] }, false));

    // Corpo inválido *e* sem sessão: a auth vem primeiro, então 401 (não 400).
    expect(res.status).toBe(401);
  });
});

describe("POST /api/chat em NDJSON", () => {
  const corpoValido = { mensagens: [{ papel: "usuario", conteudo: "Olá" }] };

  function requisicaoNdjson(corpo: unknown, autenticado = true): Request {
    const pedido = requisicao(corpo, autenticado);
    pedido.headers.set("accept", "application/x-ndjson");
    return pedido;
  }

  async function linhas(res: Response): Promise<unknown[]> {
    const texto = await res.text();
    expect(texto.endsWith("\n")).toBe(true);
    return texto.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }

  const passoDeBusca: PassoDoServidor = {
    ferramenta: { nome: "buscar_notas", argumentos: { consulta: "TCP" }, resumo: 'Buscou "TCP" — 2 nota(s)' },
    ids: ["a", "b"],
  };
  const passoDeCriacao: PassoDoServidor = {
    ferramenta: { nome: "criar_nota", argumentos: { caminho: "N.md", conteudo: "x" }, resumo: 'Criou a nota "N.md"', notaId: "n1" },
    ids: ["n1"],
  };

  it("responde 200 com os cabeçalhos de fluxo", async () => {
    vi.mocked(responder).mockResolvedValue({ resposta: "Oi!", ferramentas: [] });

    const res = await POST(requisicaoNdjson(corpoValido));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    await res.text();
  });

  it("manda os passos em ordem e depois a resposta final", async () => {
    const final = { resposta: "Pronto.", ferramentas: [passoDeBusca.ferramenta, passoDeCriacao.ferramenta] };
    vi.mocked(responder).mockImplementation(async (_mensagens, opcoes) => {
      opcoes?.aoPasso?.(passoDeBusca);
      opcoes?.aoPasso?.(passoDeCriacao);
      return final;
    });

    const res = await POST(requisicaoNdjson(corpoValido));

    expect(await linhas(res)).toEqual([
      { tipo: "passo", nome: "buscar_notas", resumo: 'Buscou "TCP" — 2 nota(s)', erro: false, ids: ["a", "b"], argumentos: { consulta: "TCP" } },
      { tipo: "passo", nome: "criar_nota", resumo: 'Criou a nota "N.md"', erro: false, ids: ["n1"], argumentos: { caminho: "N.md", conteudo: "x" }, notaId: "n1" },
      { tipo: "resposta", resposta: "Pronto.", ferramentas: final.ferramentas },
    ]);
    expect(responder).toHaveBeenCalledWith(corpoValido.mensagens, { aoPasso: expect.any(Function) });
  });

  it("entrega o passo antes de o agente terminar", async () => {
    let terminar!: () => void;
    const travado = new Promise<void>((resolver) => { terminar = resolver; });
    vi.mocked(responder).mockImplementation(async (_mensagens, opcoes) => {
      opcoes?.aoPasso?.(passoDeBusca);
      await travado;
      return { resposta: "fim", ferramentas: [passoDeBusca.ferramenta] };
    });

    const res = await POST(requisicaoNdjson(corpoValido));
    const leitor = res.body!.getReader();
    const primeiro = await leitor.read();

    expect(JSON.parse(new TextDecoder().decode(primeiro.value))).toMatchObject({ tipo: "passo", nome: "buscar_notas" });
    terminar();
    let resto = "";
    for (let l = await leitor.read(); !l.done; l = await leitor.read()) resto += new TextDecoder().decode(l.value);
    expect(JSON.parse(resto)).toMatchObject({ tipo: "resposta", resposta: "fim" });
  });

  it("marca erro: true no passo de ferramenta que falhou", async () => {
    const falho: PassoDoServidor = {
      ferramenta: { nome: "ler_nota", argumentos: { caminho: "X" }, resumo: "Nota não encontrada: X", erro: true },
      ids: [],
    };
    vi.mocked(responder).mockImplementation(async (_m, opcoes) => {
      opcoes?.aoPasso?.(falho);
      return { resposta: "Não achei.", ferramentas: [falho.ferramenta] };
    });

    const [passo] = await linhas(await POST(requisicaoNdjson(corpoValido)));

    expect(passo).toEqual({ tipo: "passo", nome: "ler_nota", resumo: "Nota não encontrada: X", erro: true, ids: [], argumentos: { caminho: "X" } });
  });

  it("termina com uma linha de erro genérica quando o agente lança, sem vazar detalhes", async () => {
    vi.mocked(responder).mockImplementation(async (_m, opcoes) => {
      opcoes?.aoPasso?.(passoDeBusca);
      throw new Error("select * from notas where user_id = 'x' -- falha de SQL");
    });

    const res = await POST(requisicaoNdjson(corpoValido));
    const texto = await res.clone().text();

    expect(res.status).toBe(200);
    expect(await linhas(res)).toEqual([
      expect.objectContaining({ tipo: "passo" }),
      { tipo: "erro", erro: "Não consegui responder agora. Tente de novo." },
    ]);
    expect(texto).not.toMatch(/select|SQL|user_id/i);
    expect(console.error).toHaveBeenCalledWith("[POST /api/chat] Falha ao responder à conversa.");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("explica a configuração ausente na linha de erro, igual ao modo JSON", async () => {
    vi.mocked(responder).mockRejectedValue(new ErroDeConfiguracao("Configure as notas.", ["DATABASE_URL"]));

    const [linha] = await linhas(await POST(requisicaoNdjson(corpoValido)));

    expect(linha).toEqual({ tipo: "erro", erro: "Configure as notas." });
  });

  it("um aoPasso chamado depois de o fluxo terminar não lança", async () => {
    let aoPassoSalvo: ((p: PassoDoServidor) => void) | undefined;
    vi.mocked(responder).mockImplementation(async (_m, opcoes) => {
      aoPassoSalvo = opcoes?.aoPasso;
      return { resposta: "ok", ferramentas: [] };
    });

    await linhas(await POST(requisicaoNdjson(corpoValido)));

    expect(() => aoPassoSalvo?.(passoDeBusca)).not.toThrow();
  });

  it("o cliente que desiste do fluxo não gera erro não tratado", async () => {
    let liberar!: () => void;
    const travado = new Promise<void>((resolver) => { liberar = resolver; });
    vi.mocked(responder).mockImplementation(async (_m, opcoes) => {
      await travado;
      opcoes?.aoPasso?.(passoDeBusca);
      return { resposta: "tarde demais", ferramentas: [] };
    });

    const res = await POST(requisicaoNdjson(corpoValido));
    await res.body!.cancel();
    liberar();
    await new Promise((resolver) => setTimeout(resolver, 10));

    expect(responder).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("aceita o cabeçalho Accept com vários tipos", async () => {
    vi.mocked(responder).mockResolvedValue({ resposta: "Oi!", ferramentas: [] });
    const pedido = requisicao(corpoValido);
    pedido.headers.set("accept", "text/event-stream, application/x-ndjson;q=0.9");

    const res = await POST(pedido);

    expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    await res.text();
  });

  it("sem o cabeçalho de NDJSON continua respondendo JSON e não passa opções ao agente", async () => {
    vi.mocked(responder).mockResolvedValue({ resposta: "Oi!", ferramentas: [] });

    const res = await POST(requisicao(corpoValido));

    expect(res.headers.get("content-type")).toContain("application/json");
    expect(responder).toHaveBeenCalledWith(corpoValido.mensagens);
  });

  it("erros antes do fluxo continuam sendo JSON com status", async () => {
    expect((await POST(requisicaoNdjson(corpoValido, false))).status).toBe(401);

    const origem = requisicaoNdjson(corpoValido);
    origem.headers.set("origin", "http://outro");
    expect((await POST(origem)).status).toBe(403);

    const invalido = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/x-ndjson", cookie: cookieValido() },
      body: "isso não é json",
    });
    const respostaInvalida = await POST(invalido);
    expect(respostaInvalida.status).toBe(400);
    expect(respostaInvalida.headers.get("content-type")).toContain("application/json");

    const semMensagens = await POST(requisicaoNdjson({ mensagens: [] }));
    expect(semMensagens.status).toBe(400);
    expect(semMensagens.headers.get("content-type")).toContain("application/json");

    vi.stubEnv("GEMINI_API_KEY", "");
    const semChave = await POST(requisicaoNdjson(corpoValido));
    expect(semChave.status).toBe(503);
    expect(semChave.headers.get("content-type")).toContain("application/json");
    expect(responder).not.toHaveBeenCalled();
  });
});
