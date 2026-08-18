import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarTokenDeSessao, verificarTokenDeSessao } from "./sessao";

/** HMAC precisa de chave longa; o módulo recusa segredo curto de propósito. */
const SEGREDO = "um-segredo-de-testes-com-mais-de-32-caracteres";
const AGORA = 1_700_000_000_000;

describe("sessao", () => {
  beforeEach(() => {
    process.env.SEGREDO_SESSAO = SEGREDO;
  });

  afterEach(() => {
    delete process.env.SEGREDO_SESSAO;
  });

  it("aceita um token que ele mesmo acabou de criar", () => {
    const token = criarTokenDeSessao(AGORA);
    expect(verificarTokenDeSessao(token, AGORA)).toEqual({ tipo: "valida" });
  });

  it("recusa quando não há token", () => {
    expect(verificarTokenDeSessao(undefined, AGORA)).toEqual({ tipo: "ausente" });
    expect(verificarTokenDeSessao("", AGORA)).toEqual({ tipo: "ausente" });
  });

  it("recusa token com assinatura adulterada", () => {
    const token = criarTokenDeSessao(AGORA);
    const adulterado = `${token.slice(0, -1)}${token.at(-1) === "A" ? "B" : "A"}`;

    expect(verificarTokenDeSessao(adulterado, AGORA)).toEqual({ tipo: "invalida" });
  });

  it("recusa quando alguém esticou a validade sem reassinar", () => {
    const token = criarTokenDeSessao(AGORA);
    const assinatura = token.slice(token.lastIndexOf(".") + 1);
    const forjado = `${AGORA + 10_000_000_000}.${assinatura}`;

    expect(verificarTokenDeSessao(forjado, AGORA)).toEqual({ tipo: "invalida" });
  });

  it("recusa token sem o separador de assinatura", () => {
    expect(verificarTokenDeSessao("tokenSemPonto", AGORA)).toEqual({ tipo: "invalida" });
  });

  it("recusa token assinado com outro segredo", () => {
    const token = criarTokenDeSessao(AGORA);
    process.env.SEGREDO_SESSAO = `${SEGREDO}-outro-completamente-diferente`;

    expect(verificarTokenDeSessao(token, AGORA)).toEqual({ tipo: "invalida" });
  });

  it("expira o token depois da validade", () => {
    const token = criarTokenDeSessao(AGORA);
    const trintaEUmDias = 31 * 24 * 60 * 60 * 1000;

    expect(verificarTokenDeSessao(token, AGORA + trintaEUmDias)).toEqual({ tipo: "expirada" });
  });

  it("ainda aceita o token um dia antes de expirar", () => {
    const token = criarTokenDeSessao(AGORA);
    const vinteENoveDias = 29 * 24 * 60 * 60 * 1000;

    expect(verificarTokenDeSessao(token, AGORA + vinteENoveDias)).toEqual({ tipo: "valida" });
  });

  it("recusa tudo quando SEGREDO_SESSAO não está definido", () => {
    const token = criarTokenDeSessao(AGORA);
    delete process.env.SEGREDO_SESSAO;

    expect(verificarTokenDeSessao(token, AGORA).tipo).toBe("nao-configurado");
  });

  it("recusa tudo quando SEGREDO_SESSAO é curto demais para ser chave de HMAC", () => {
    process.env.SEGREDO_SESSAO = "curto";
    expect(verificarTokenDeSessao("qualquer.coisa", AGORA).tipo).toBe("nao-configurado");
  });

  it("lança erro claro ao tentar criar token sem segredo configurado", () => {
    delete process.env.SEGREDO_SESSAO;
    expect(() => criarTokenDeSessao(AGORA)).toThrow(/SEGREDO_SESSAO/);
  });
});
