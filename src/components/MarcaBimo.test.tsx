import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarcaBimo from "./MarcaBimo";

/**
 * Largura/altura do `viewBox` do arquivo de verdade. O componente guarda essas
 * proporções fixas (no Vitest o import de SVG é só uma URL), então é este teste
 * que pega a marca sendo trocada sem a constante acompanhar — o que distorceria
 * o logo em todo lugar.
 */
function lerViewBox(nome: string): { valor: string; proporcao: number } {
  const svg = readFileSync(join(process.cwd(), "src/assets", nome), "utf8");
  const valor = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!valor) throw new Error(`${nome} não tem viewBox`);
  const [, , largura, altura] = valor.trim().split(/[\s,]+/).map(Number);
  return { valor, proporcao: largura / altura };
}

/** O Vite embute SVG pequeno como `data:` URI; o Next serve por URL. Vale o nome ou o próprio conteúdo. */
function apontaPara(src: string | null | undefined, nome: string, viewBox: string): boolean {
  if (!src) return false;
  return src.includes(nome) || decodeURIComponent(src).includes(viewBox);
}

describe("MarcaBimo", () => {
  it.each([
    { tamanho: 96, arquivo: "bimo-marca.svg" },
    { tamanho: 48, arquivo: "bimo-marca.svg" },
    { tamanho: 40, arquivo: "bimo-marca-pequena.svg" },
    { tamanho: 16, arquivo: "bimo-marca-pequena.svg" },
  ])("em $tamanho px usa $arquivo na proporção do viewBox", ({ tamanho, arquivo }) => {
    const { container } = render(<MarcaBimo tamanho={tamanho} />);
    const imagem = container.querySelector("img");
    const viewBox = lerViewBox(arquivo);

    expect(apontaPara(imagem?.getAttribute("src"), arquivo, viewBox.valor)).toBe(true);
    expect(imagem?.getAttribute("height")).toBe(String(tamanho));
    expect(imagem?.getAttribute("width")).toBe(String(Math.round(tamanho * viewBox.proporcao)));
  });
});
