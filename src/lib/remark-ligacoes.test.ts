import { describe, expect, it } from "vitest";
import { PREFIXO_DE_ANEXO, PREFIXO_DE_NOTA, remarkLigacoes, type NoMdast } from "./remark-ligacoes";

function paragrafo(...filhos: NoMdast[]): NoMdast {
  return { type: "paragraph", children: filhos };
}
const texto = (value: string): NoMdast => ({ type: "text", value });

function transformar(raiz: NoMdast): NoMdast {
  remarkLigacoes()(raiz);
  return raiz;
}

describe("remarkLigacoes", () => {
  it("troca [[Nota]] por um link para a nota, mantendo o texto em volta", () => {
    const raiz = transformar({ type: "root", children: [paragrafo(texto("veja [[Notas atômicas]] agora"))] });

    expect(raiz.children![0].children).toEqual([
      { type: "text", value: "veja " },
      {
        type: "link",
        url: `${PREFIXO_DE_NOTA}${encodeURIComponent("Notas atômicas")}`,
        children: [{ type: "text", value: "Notas atômicas" }],
      },
      { type: "text", value: " agora" },
    ]);
  });

  it("mostra o apelido quando há, e a seção depois do nome quando não há", () => {
    const raiz = transformar({ type: "root", children: [paragrafo(texto("[[A|apelido]] e [[B#Seção]]"))] });
    const links = raiz.children![0].children!.filter((no) => no.type === "link");

    expect(links.map((no) => no.children![0].value)).toEqual(["apelido", "B › Seção"]);
    expect(links.map((no) => decodeURIComponent(no.url!.slice(PREFIXO_DE_NOTA.length).split("#")[0]))).toEqual(["A", "B"]);
  });

  it("leva a seção junto na URL, para quem for abrir a nota poder rolar até ela", () => {
    const raiz = transformar({ type: "root", children: [paragrafo(texto("[[B#Seção]]"))] });

    expect(raiz.children![0].children![0].url).toBe(`${PREFIXO_DE_NOTA}B#Se%C3%A7%C3%A3o`);
  });

  it("anexos viram um marcador, nunca um link para nota", () => {
    const raiz = transformar({ type: "root", children: [paragrafo(texto("![[foto.png]] e [[doc.pdf]]"))] });
    const links = raiz.children![0].children!.filter((no) => no.type === "link");

    expect(links.map((no) => no.url!.startsWith(PREFIXO_DE_ANEXO))).toEqual([true, true]);
    expect(links.map((no) => no.children![0].value)).toEqual(["foto.png", "doc.pdf"]);
  });

  it("uma nota embutida (![[Nota]]) é tratada como ligação comum", () => {
    const raiz = transformar({ type: "root", children: [paragrafo(texto("![[Outra nota]]"))] });

    expect(raiz.children![0].children![0].url).toBe(`${PREFIXO_DE_NOTA}${encodeURIComponent("Outra nota")}`);
  });

  it("não mexe em código em linha, bloco de código nem texto que já está dentro de um link", () => {
    const raiz = transformar({
      type: "root",
      children: [
        paragrafo({ type: "inlineCode", value: "[[A]]" }),
        { type: "code", value: "[[B]]" },
        paragrafo({ type: "link", url: "https://x.com", children: [texto("[[C]]")] }),
      ],
    });

    expect(raiz.children![0].children).toEqual([{ type: "inlineCode", value: "[[A]]" }]);
    expect(raiz.children![1]).toEqual({ type: "code", value: "[[B]]" });
    expect(raiz.children![2].children![0].children).toEqual([texto("[[C]]")]);
  });

  it("entra em listas, citações e títulos", () => {
    const raiz = transformar({
      type: "root",
      children: [
        { type: "heading", depth: 2, children: [texto("Sobre [[A]]")] },
        { type: "blockquote", children: [paragrafo(texto("[[B]]"))] },
        { type: "list", children: [{ type: "listItem", children: [paragrafo(texto("[[C]]"))] }] },
      ],
    });

    const links = JSON.stringify(raiz).match(/"type":"link"/g);
    expect(links).toHaveLength(3);
  });

  it("deixa em paz o texto sem ligação e a ligação malformada", () => {
    const raiz = transformar({ type: "root", children: [paragrafo(texto("nada aqui [[sem fim e [[]]"))] });

    expect(raiz.children![0].children).toEqual([texto("nada aqui [[sem fim e [[]]")]);
  });
});
