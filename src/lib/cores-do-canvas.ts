/**
 * Cores para o canvas, que não enxerga o CSS: as variáveis chegam como texto
 * (quase sempre hex) e aqui viram mistura e transparência. Sem hex, cai no
 * `color-mix` do navegador, que o canvas também entende.
 */

type Rgb = readonly [number, number, number];

function limitar(valor: number): number {
  return Math.min(1, Math.max(0, valor));
}

function lerHex(cor: string): Rgb | null {
  const texto = cor.trim();
  const curto = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(texto);
  if (curto) return curto.slice(1).map((d) => parseInt(d + d, 16)) as unknown as Rgb;
  const longo = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(texto);
  if (longo) return longo.slice(1).map((d) => parseInt(d, 16)) as unknown as Rgb;
  return null;
}

function emHex([r, g, b]: Rgb): string {
  const par = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${par(r)}${par(g)}${par(b)}`;
}

/** A mesma cor com a opacidade dada (0..1). */
export function comAlfa(cor: string, alfa: number): string {
  const a = limitar(alfa);
  const rgb = lerHex(cor);
  if (rgb) return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  return `color-mix(in srgb, ${cor} ${a * 100}%, transparent)`;
}

/** `a` com `quantidade` (0..1) de `b` por cima: 0 devolve `a`, 1 devolve `b`. */
export function misturar(a: string, b: string, quantidade: number): string {
  const t = limitar(quantidade);
  if (t <= 0) return a;
  if (t >= 1) return b;
  const rgbA = lerHex(a);
  const rgbB = lerHex(b);
  if (rgbA && rgbB) {
    return emHex([
      rgbA[0] + (rgbB[0] - rgbA[0]) * t,
      rgbA[1] + (rgbB[1] - rgbA[1]) * t,
      rgbA[2] + (rgbB[2] - rgbA[2]) * t,
    ]);
  }
  return `color-mix(in srgb, ${b} ${t * 100}%, ${a})`;
}
