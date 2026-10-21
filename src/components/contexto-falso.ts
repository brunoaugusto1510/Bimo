/**
 * O jsdom não tem canvas. Este contexto falso só anota o que foi desenhado — e
 * com qual estilo no momento da chamada, que é o que importa (a cor e a
 * opacidade são estado do contexto, definidos antes de cada `fill`/`stroke`).
 * Só os testes do desenho usam.
 */

export type Gradiente = {
  tipo: "gradiente";
  x: number;
  y: number;
  raio: number;
  paradas: Array<[number, string]>;
  addColorStop: (posicao: number, cor: string) => void;
};

export type Chamada =
  | { tipo: "preencher"; cor: unknown; alfa: number; x: number; y: number; raio: number }
  | {
      tipo: "tracar";
      cor: unknown;
      alfa: number;
      largura: number;
      segmentos: number;
      tracejado: number[];
      x: number;
      y: number;
      raio: number;
    }
  | { tipo: "texto"; texto: string; cor: unknown; x: number; y: number };

export function criarContextoFalso() {
  const chamadas: Chamada[] = [];
  let arco = { x: 0, y: 0, raio: 0 };
  let segmentos = 0;
  let tracejado: number[] = [];
  const pilha = { profundidade: 0, maxima: 0 };

  const contexto = {
    fillStyle: "" as unknown,
    strokeStyle: "" as unknown,
    globalAlpha: 1,
    lineWidth: 1,
    lineDashOffset: 0,
    lineJoin: "miter",
    lineCap: "butt",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    clearRect: () => {},
    save: () => {
      pilha.profundidade += 1;
      pilha.maxima = Math.max(pilha.maxima, pilha.profundidade);
    },
    restore: () => {
      pilha.profundidade -= 1;
    },
    beginPath: () => {
      segmentos = 0;
    },
    closePath: () => {},
    moveTo: () => {
      segmentos += 1;
    },
    lineTo: () => {},
    arcTo: () => {},
    arc: (x: number, y: number, raio: number) => {
      arco = { x, y, raio };
    },
    setLineDash: (valores: number[]) => {
      tracejado = [...valores];
    },
    createRadialGradient: (_x0: number, _y0: number, _r0: number, x: number, y: number, raio: number) => {
      const paradas: Array<[number, string]> = [];
      const gradiente: Gradiente = {
        tipo: "gradiente",
        x,
        y,
        raio,
        paradas,
        addColorStop: (posicao, cor) => void paradas.push([posicao, cor]),
      };
      return gradiente;
    },
    measureText: (texto: string) => ({ width: texto.length * 6 }),
    fill: () => {
      chamadas.push({
        tipo: "preencher",
        cor: contexto.fillStyle,
        alfa: contexto.globalAlpha,
        ...arco,
      });
    },
    stroke: () => {
      chamadas.push({
        tipo: "tracar",
        cor: contexto.strokeStyle,
        alfa: contexto.globalAlpha,
        largura: contexto.lineWidth,
        segmentos,
        tracejado: [...tracejado],
        ...arco,
      });
    },
    strokeText: () => {},
    fillText: (texto: string, x: number, y: number) => {
      chamadas.push({ tipo: "texto", texto, cor: contexto.fillStyle, x, y });
    },
  };

  return { contexto: contexto as unknown as CanvasRenderingContext2D, chamadas, pilha };
}

export const preenchimentos = (chamadas: Chamada[]) =>
  chamadas.filter((c): c is Extract<Chamada, { tipo: "preencher" }> => c.tipo === "preencher");
export const tracos = (chamadas: Chamada[]) =>
  chamadas.filter((c): c is Extract<Chamada, { tipo: "tracar" }> => c.tipo === "tracar");
export const textos = (chamadas: Chamada[]) =>
  chamadas.filter((c): c is Extract<Chamada, { tipo: "texto" }> => c.tipo === "texto");
