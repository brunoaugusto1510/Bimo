import { describe, expect, it } from "vitest";
import { criarResolvedor } from "../ligacoes";
import {
  avisoDeAbertura, avisoDeInsercao, paraItemDaLista, planejarInsercao, rotuloDaLista, sugerirComandos, sugerirParaGatilho, sugerirTags,
  type Sugestao,
} from "./sugestoes";

const notas = [{ id: "1", titulo: "Receitas", pasta: "Cozinha" }, { id: "2", titulo: "Atual", pasta: null }];
const contexto = {
  notas, idAtual: "2", pastaAtual: null, resolver: criarResolvedor(notas),
  tagsDasNotas: ["ideia", "estudo", "projeto/bimo", "Ideias", "com espaco"], tagsDaNota: ["rascunho", "IDEIA"],
};

describe("sugerirTags", () => {
  it("junta as tags da nota e as das outras, sem repetir (maiúsculas não contam) e sem as que têm espaço", () => {
    const nomes = sugerirTags({ nomes: contexto.tagsDasNotas, daNota: contexto.tagsDaNota, consulta: "i" }).map((s) => s.id);
    expect(nomes.filter((nome) => nome.toLowerCase() === "ideia")).toHaveLength(1);
    expect(nomes).toContain("Ideias");
    expect(nomes).not.toContain("com espaco");
  });
  it("ordena por quão bem a consulta casa e devolve os trechos para destacar", () => {
    const [primeira] = sugerirTags({ nomes: ["gimbal", "bimo", "limbo"], daNota: [], consulta: "bim" });
    expect(primeira).toMatchObject({ tipo: "tag", id: "bimo", intervalos: [[0, 3]] });
  });
  it("as tags da própria nota vencem o empate de relevância", () => {
    const nomes = ["bimo-a", "bimo-b", "bimo-c"];
    expect(sugerirTags({ nomes, daNota: ["bimo-c"], consulta: "bimo" }).map((s) => s.id)[0]).toBe("bimo-c");
  });
  it("não lista quando a única opção já é o que foi digitado", () => {
    expect(sugerirTags({ nomes: ["ideia"], daNota: [], consulta: "ideia" })).toEqual([]);
    expect(sugerirTags({ nomes: ["ideia"], daNota: [], consulta: "IDEIA" })).toEqual([]);
    expect(sugerirTags({ nomes: ["ideia", "ideias"], daNota: [], consulta: "ideia" }).map((s) => s.id)).toEqual(["ideia", "ideias"]);
  });
  it("respeita o limite", () => {
    const nomes = Array.from({ length: 20 }, (_, i) => `tag${i}`);
    expect(sugerirTags({ nomes, daNota: [], consulta: "tag" })).toHaveLength(8);
    expect(sugerirTags({ nomes, daNota: [], consulta: "tag", limite: 2 })).toHaveLength(2);
  });
  it("acha tags com / e acentos", () => {
    expect(sugerirTags({ nomes: ["projeto/bimo", "ação"], daNota: [], consulta: "acao" }).map((s) => s.id)).toEqual(["ação"]);
    expect(sugerirTags({ nomes: ["projeto/bimo"], daNota: [], consulta: "bimo" }).map((s) => s.id)).toEqual(["projeto/bimo"]);
  });
});

describe("sugerirComandos", () => {
  it("sem consulta lista todos na ordem do menu", () => {
    const titulos = sugerirComandos("").map((s) => s.titulo);
    expect(titulos[0]).toBe("Título 1"); expect(titulos).toHaveLength(10); expect(titulos.at(-1)).toBe("Tabela");
  });
  it("filtra por nome, sem acento e sem maiúsculas", () => {
    expect(sugerirComandos("titulo").map((s) => s.id)).toEqual(["titulo-1", "titulo-2", "titulo-3"]);
    expect(sugerirComandos("CITACAO").map((s) => s.id)).toEqual(["citacao"]);
    expect(sugerirComandos("lista").map((s) => s.id).sort()).toEqual(["lista", "numerada"]);
  });
  it("sem resultado devolve vazio", () => {
    expect(sugerirComandos("zzz")).toEqual([]);
  });
});

describe("sugerirParaGatilho", () => {
  it("escolhe a fonte pelo tipo do gatilho", () => {
    expect(sugerirParaGatilho({ tipo: "ligacao", inicio: 0, consulta: "rece" }, contexto)[0]).toMatchObject({ tipo: "ligacao", id: "1" });
    expect(sugerirParaGatilho({ tipo: "tag", inicio: 0, consulta: "estu" }, contexto)[0]).toMatchObject({ tipo: "tag", id: "estudo" });
    expect(sugerirParaGatilho({ tipo: "comando", inicio: 0, consulta: "tab" }, contexto)[0]).toMatchObject({ tipo: "comando", id: "tabela" });
  });
});

describe("itens da lista e avisos", () => {
  const ligacao: Sugestao = { tipo: "ligacao", id: "1", titulo: "Receitas", pasta: "Cozinha", alvo: "Receitas", intervalos: [[0, 3]] };
  const tag: Sugestao = { tipo: "tag", id: "ideia", intervalos: [[0, 2]] };
  const comando: Sugestao = { tipo: "comando", id: "titulo-1", titulo: "Título 1", detalhe: "# ", intervalos: [[0, 3]] };
  it("ligação: pasta no detalhe e no nome acessível", () => {
    expect(paraItemDaLista(ligacao)).toEqual({ id: "1", titulo: "Receitas", detalhe: "Cozinha", detalheDecorativo: false, rotulo: "Receitas, na pasta Cozinha", intervalos: [[0, 3]] });
  });
  it("tag: mostra o # e desloca o destaque", () => {
    expect(paraItemDaLista(tag)).toEqual({ id: "ideia", titulo: "#ideia", detalhe: null, detalheDecorativo: false, rotulo: "#ideia", intervalos: [[1, 3]] });
  });
  it("comando: a sintaxe é só enfeite para quem usa leitor de tela", () => {
    expect(paraItemDaLista(comando)).toEqual({ id: "titulo-1", titulo: "Título 1", detalhe: "# ", detalheDecorativo: true, rotulo: "Título 1", intervalos: [[0, 3]] });
  });
  it("rótulo da lista e avisos por tipo", () => {
    expect(rotuloDaLista("ligacao")).toBe("Notas para ligar"); expect(rotuloDaLista("tag")).toBe("Tags"); expect(rotuloDaLista("comando")).toBe("Comandos de formatação");
    expect(avisoDeAbertura("ligacao", 1)).toBe("1 nota sugerida. Setas escolhem, Enter insere, Esc fecha.");
    expect(avisoDeAbertura("tag", 3)).toBe("3 tags sugeridas. Setas escolhem, Enter insere a escolhida, Esc fecha.");
    expect(avisoDeAbertura("comando", 10)).toBe("10 comandos. Setas escolhem, Enter aplica, Esc fecha.");
    expect(avisoDeInsercao(ligacao)).toBe("Ligação inserida: «Receitas»");
    expect(avisoDeInsercao(tag)).toBe("Tag #ideia inserida");
    expect(avisoDeInsercao(comando)).toBe("Aplicado: Título 1");
  });
  it("comandos de bloco dizem onde o cursor ficou, e a tabela diz o tamanho no nome", () => {
    const de = (id: "codigo" | "divisor" | "tabela", titulo: string): Sugestao => ({ tipo: "comando", id, titulo, detalhe: "", intervalos: [] });
    expect(avisoDeInsercao(de("codigo", "Bloco de código"))).toBe("Bloco de código inserido. Cursor dentro do bloco.");
    expect(avisoDeInsercao(de("divisor", "Divisor"))).toBe("Divisor inserido. Cursor na linha seguinte.");
    expect(avisoDeInsercao(de("tabela", "Tabela"))).toBe("Tabela 2 por 2 inserida. Cabeçalho da primeira coluna selecionado.");
    expect(paraItemDaLista(de("tabela", "Tabela")).rotulo).toBe("Tabela, 2 por 2");
  });
});

describe("planejarInsercao", () => {
  it("ligação: fecha com ]] sem duplicar", () => {
    expect(planejarInsercao("ver [[re]] fim", { tipo: "ligacao", inicio: 4, consulta: "re" }, 8, { tipo: "ligacao", id: "1", titulo: "Receitas", pasta: null, alvo: "Receitas", intervalos: [] }))
      .toEqual({ de: 6, ate: 10, texto: "Receitas]]", cursor: 16 });
  });
  it("tag: troca #consulta por #nome", () => {
    const texto = "nota #ide aqui";
    const edicao = planejarInsercao(texto, { tipo: "tag", inicio: 5, consulta: "ide" }, 9, { tipo: "tag", id: "ideia", intervalos: [] });
    expect(texto.slice(0, edicao.de) + edicao.texto + texto.slice(edicao.ate)).toBe("nota #ideia aqui");
    expect(edicao.cursor).toBe("nota #ideia".length);
  });
  it("comando: aplica a formatação e apaga o /consulta", () => {
    const texto = "/tit";
    const edicao = planejarInsercao(texto, { tipo: "comando", inicio: 0, consulta: "tit" }, 4, { tipo: "comando", id: "titulo-2", titulo: "Título 2", detalhe: "## ", intervalos: [] });
    expect(texto.slice(0, edicao.de) + edicao.texto + texto.slice(edicao.ate)).toBe("## ");
  });
});
