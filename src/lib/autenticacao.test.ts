import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  exigirSessao,
  lerCookie,
  opcoesDoCookieDeSessao,
  respostaDeRecusaParaApi,
  verificarSessaoDoPedido,
} from "./autenticacao";
import { NOME_DO_COOKIE, criarTokenDeSessao } from "./sessao";

const SEGREDO = "um-segredo-de-testes-com-mais-de-32-caracteres";

function pedidoCom(cookie?: string): Request {
  return new Request("https://bimo.local/", {
    headers: cookie ? { cookie } : {},
  });
}

function pedidoAutenticado(): Request {
  return pedidoCom(`${NOME_DO_COOKIE}=${criarTokenDeSessao()}`);
}

describe("lerCookie", () => {
  it("acha o cookie quando é o único", () => {
    expect(lerCookie(pedidoCom("bimo_sessao=abc"), "bimo_sessao")).toBe("abc");
  });

  it("acha o cookie no meio de outros, ignorando espaços", () => {
    const pedido = pedidoCom("tema=escuro; bimo_sessao=abc123; outro=1");
    expect(lerCookie(pedido, "bimo_sessao")).toBe("abc123");
  });

  it("devolve undefined quando o cookie não está lá", () => {
    expect(lerCookie(pedidoCom("tema=escuro"), "bimo_sessao")).toBeUndefined();
  });

  it("devolve undefined quando não há cabeçalho de cookie", () => {
    expect(lerCookie(pedidoCom(), "bimo_sessao")).toBeUndefined();
  });

  it("não confunde um cookie cujo nome termina igual", () => {
    const pedido = pedidoCom("nao_bimo_sessao=intruso");
    expect(lerCookie(pedido, "bimo_sessao")).toBeUndefined();
  });
});

describe("verificarSessaoDoPedido", () => {
  beforeEach(() => {
    process.env.SEGREDO_SESSAO = SEGREDO;
  });

  afterEach(() => {
    delete process.env.SEGREDO_SESSAO;
  });

  it("aceita um pedido com cookie de sessão válido", () => {
    expect(verificarSessaoDoPedido(pedidoAutenticado())).toEqual({ tipo: "valida" });
  });

  it("recusa pedido sem cookie nenhum", () => {
    expect(verificarSessaoDoPedido(pedidoCom())).toEqual({ tipo: "ausente" });
  });

  it("recusa cookie de sessão adulterado", () => {
    const pedido = pedidoCom(`${NOME_DO_COOKIE}=1700000000000.assinatura-inventada`);
    expect(verificarSessaoDoPedido(pedido)).toEqual({ tipo: "invalida" });
  });
});

describe("exigirSessao", () => {
  beforeEach(() => {
    process.env.SEGREDO_SESSAO = SEGREDO;
  });

  afterEach(() => {
    delete process.env.SEGREDO_SESSAO;
  });

  it("devolve null quando a sessão é válida (pode seguir)", () => {
    expect(exigirSessao(pedidoAutenticado())).toBeNull();
  });

  it("devolve 401 quando não há sessão", () => {
    const resposta = exigirSessao(pedidoCom());
    expect(resposta?.status).toBe(401);
  });

  it("devolve 503 quando SEGREDO_SESSAO não está configurada", () => {
    const pedido = pedidoAutenticado();
    delete process.env.SEGREDO_SESSAO;

    const resposta = exigirSessao(pedido);
    expect(resposta?.status).toBe(503);
  });
});

describe("respostaDeRecusaParaApi", () => {
  it("não manda WWW-Authenticate (não é mais basic auth)", () => {
    const resposta = respostaDeRecusaParaApi({ tipo: "ausente" });
    expect(resposta.headers.get("www-authenticate")).toBeNull();
  });

  it("responde 401 para sessão expirada", () => {
    expect(respostaDeRecusaParaApi({ tipo: "expirada" }).status).toBe(401);
  });

  it("não vaza o segredo da sessão no corpo", async () => {
    process.env.SEGREDO_SESSAO = SEGREDO;
    const corpo = await respostaDeRecusaParaApi({ tipo: "invalida" }).text();

    expect(corpo).not.toContain(SEGREDO);
    delete process.env.SEGREDO_SESSAO;
  });
});

describe("opcoesDoCookieDeSessao", () => {
  it("marca o cookie como HttpOnly e SameSite=lax", () => {
    const opcoes = opcoesDoCookieDeSessao();

    expect(opcoes.httpOnly).toBe(true);
    expect(opcoes.sameSite).toBe("lax");
    expect(opcoes.path).toBe("/");
  });
});
