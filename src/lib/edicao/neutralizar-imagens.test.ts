import { describe, expect, it } from "vitest";
import { neutralizarImagens } from "./neutralizar-imagens";

describe("neutralizarImagens", () => {
  it("troca a imagem pelo texto alternativo", () => {
    expect(neutralizarImagens("antes ![logo](https://x.exemplo/a.png) depois")).toBe("antes logo depois");
    expect(neutralizarImagens("![](https://x.exemplo/?d=segredo)")).toBe("");
  });
  it("cobre a imagem com título e a de referência (e a definição da referência)", () => {
    expect(neutralizarImagens('![alt](https://x.exemplo/a.png "título")')).toBe("alt");
    expect(neutralizarImagens("veja ![alt][1]\n\n[1]: https://x.exemplo/a.png")).toBe("veja alt\n\n");
    expect(neutralizarImagens("![alt][]")).toBe("alt");
  });
  it("cobre a tag <img> em HTML cru", () => {
    expect(neutralizarImagens('texto <img src="https://x.exemplo/a.png" alt="a"> fim')).toBe("texto  fim");
  });
  it("deixa links comuns, wikilinks e imagens locais do Obsidian como estão", () => {
    const texto = "um [link](https://exemplo.com), [[Nota]] e ![[foto.png]]";
    expect(neutralizarImagens(texto)).toBe(texto);
  });
  it("não deixa uma remoção formar outra imagem", () => {
    expect(neutralizarImagens("!![x](https://a.b)[y](https://c.d)")).not.toMatch(/!\[[^\]]*\]\(/);
  });
});
