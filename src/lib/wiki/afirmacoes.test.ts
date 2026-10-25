import { describe, expect, it } from "vitest";
import { afirmacoesVisiveis, garantirIds, idDaAfirmacao, LIMITE_DE_AFIRMACOES_VISIVEIS } from "./afirmacoes";
import type { AfirmacaoWiki } from "./tipos";

const afirmacao = (texto: string, fonteId = "1", citacao = "trecho citado da nota"): Omit<AfirmacaoWiki, "id"> => ({
  texto, natureza: "explicita", evidencias: [{ fonteId, citacao, inicio: 0, fim: citacao.length }] });

describe("id da afirmação", () => {
  it("é estável e ignora caixa, acento e espaços; muda com o texto ou a evidência", () => {
    const base = idDaAfirmacao(afirmacao("O limite é de dez itens."));
    expect(base).toMatch(/^a[0-9a-f]{10}$/);
    expect(idDaAfirmacao(afirmacao("  o LIMITE é de dez   itens. "))).toBe(base);
    expect(idDaAfirmacao(afirmacao("O limite é de vinte itens."))).not.toBe(base);
    expect(idDaAfirmacao(afirmacao("O limite é de dez itens.", "2"))).not.toBe(base);
    expect(idDaAfirmacao(afirmacao("O limite é de dez itens.", "1", "outro trecho citado"))).not.toBe(base);
  });

  it("trata ênfase, colchetes e aspas tipográficas como as citações: não muda o id", () => {
    const simples = idDaAfirmacao(afirmacao("Texto", "1", 'O cache fica "velho" muito rápido'));
    expect(idDaAfirmacao(afirmacao("Texto", "1", "O cache fica “velho” **muito** [[rápido]]"))).toBe(simples);
  });

  it("não depende da posição guardada nem da ordem das evidências", () => {
    const a = { texto: "X", natureza: "explicita" as const, evidencias: [{ fonteId: "1", citacao: "um trecho", inicio: 0, fim: 9 }, { fonteId: "2", citacao: "outro trecho", inicio: 4, fim: 16 }] };
    const b = { ...a, evidencias: [{ ...a.evidencias[1], inicio: 99, fim: 111 }, { ...a.evidencias[0], inicio: 7, fim: 16 }] };
    expect(idDaAfirmacao(a)).toBe(idDaAfirmacao(b));
  });

  it("garantirIds preserva os ids que existem e preenche os que faltam, sem mexer no resto", () => {
    const [com, sem] = garantirIds([{ ...afirmacao("Já tem id"), id: "a-existente" }, afirmacao("Ainda não tem")]);
    expect(com.id).toBe("a-existente");
    expect(sem.id).toBe(idDaAfirmacao(afirmacao("Ainda não tem")));
    expect(sem.texto).toBe("Ainda não tem");
  });
});

describe("afirmações que o modelo vê", () => {
  const muitas = Array.from({ length: 40 }, (_, i) => ({ ...afirmacao(`Afirmação ${i}`, i < 5 ? "9" : "1"), id: `a${i}` }));

  it("mostra no máximo o limite, com as da origem primeiro e a ordem original entre elas", () => {
    const vistas = afirmacoesVisiveis(muitas, { origemId: "9" });
    expect(vistas).toHaveLength(LIMITE_DE_AFIRMACOES_VISIVEIS);
    expect(vistas.slice(0, 5).map((a) => a.id)).toEqual(["a0", "a1", "a2", "a3", "a4"]);
    expect(vistas[5].id).toBe("a5");
  });

  it("traz as da origem mesmo quando elas vêm depois das outras na síntese", () => {
    const invertidas = [...muitas.slice(5), ...muitas.slice(0, 5)];
    expect(afirmacoesVisiveis(invertidas, { origemId: "9" }).slice(0, 5).map((a) => a.id).sort()).toEqual(["a0", "a1", "a2", "a3", "a4"]);
  });

  it("com poucas afirmações, mostra todas", () => {
    expect(afirmacoesVisiveis(muitas.slice(0, 3), { origemId: "1" })).toHaveLength(3);
  });

  it("as obsoletas vêm antes das da origem, e depois delas as que falam do assunto do trecho", () => {
    const vistas = afirmacoesVisiveis(muitas, {
      origemId: "9", obsoletas: new Set(["a30", "a31"]), relacionada: (texto) => texto === "Afirmação 20" || texto === "Afirmação 21",
    }).map((a) => a.id);
    expect(vistas.slice(0, 2)).toEqual(["a30", "a31"]);
    expect(vistas.slice(2, 7)).toEqual(["a0", "a1", "a2", "a3", "a4"]);
    expect(vistas.slice(7, 9)).toEqual(["a20", "a21"]);
    expect(vistas[9]).toBe("a5");
  });
});
