import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import { posicionarNo } from "./posicionamento";

// Valores no espírito dos padrões do d3-force, ajustáveis depois de ver o
// resultado no aparelho.
const REPULSAO = -30;
const COMPRIMENTO_DA_MOLA = 60;
const RIGIDEZ = 0.05;
const ATRACAO_AO_CENTRO = 0.02;
const ATRITO = 0.6;
const DECAIMENTO_DO_ALPHA = 0.0228;
const ALPHA_MINIMO = 0.001;
// Dois nós exatamente sobrepostos não têm direção de repulsão definida. Este
// piso evita divisão por zero e dá um empurrão determinístico no eixo x.
const DISTANCIA_MINIMA = 1;
const MILISSEGUNDOS_POR_QUADRO = 16.67;
// Um quadro perdido não pode teleportar o grafo: sem o teto, voltar do
// segundo plano entregaria um dt de segundos e explodiria as posições.
const PASSO_MAXIMO = 2;

export type NoSimulado = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  peso: number;
  fixo: boolean;
};

export type EstadoSimulacao = {
  nos: NoSimulado[];
  // Índices em `nos`, resolvidos uma vez na criação — o caminho quente não
  // pode procurar nó por id a cada quadro.
  ligacoes: [number, number][];
  alpha: number;
  largura: number;
  altura: number;
};

export function criarSimulacao(
  nos: NoDoGrafo[],
  arestas: Aresta[],
  largura: number,
  altura: number,
): EstadoSimulacao {
  const indicePorId = new Map(nos.map((no, indice) => [no.id, indice]));

  return {
    nos: nos.map((no) => {
      const { x, y } = posicionarNo(no, largura, altura);
      return { id: no.id, x, y, vx: 0, vy: 0, peso: no.peso, fixo: false };
    }),
    ligacoes: arestas.flatMap((aresta): [number, number][] => {
      const de = indicePorId.get(aresta.de);
      const para = indicePorId.get(aresta.para);
      // Aresta apontando para nota que sumiu do vault é descartada.
      return de === undefined || para === undefined ? [] : [[de, para]];
    }),
    alpha: 1,
    largura,
    altura,
  };
}

// Muta o estado recebido de propósito, ao contrário de `avancarCampo` em
// fisica.ts: a 120 Hz, devolver um array novo por quadro produz lixo que o GC
// recolhe 120 vezes por segundo, e as pausas aparecem como travamento.
export function avancarSimulacao(estado: EstadoSimulacao, dt: number): void {
  "worklet";
  const passo = Math.min(dt / MILISSEGUNDOS_POR_QUADRO, PASSO_MAXIMO);
  const { nos, alpha } = estado;
  const centroX = estado.largura / 2;
  const centroY = estado.altura / 2;

  for (let a = 0; a < nos.length; a += 1) {
    for (let b = a + 1; b < nos.length; b += 1) {
      const primeiro = nos[a];
      const segundo = nos[b];
      let dx = segundo.x - primeiro.x;
      let dy = segundo.y - primeiro.y;
      let distancia = Math.hypot(dx, dy);

      if (distancia < DISTANCIA_MINIMA) {
        dx = DISTANCIA_MINIMA;
        dy = 0;
        distancia = DISTANCIA_MINIMA;
      }

      const forca = (REPULSAO * primeiro.peso * segundo.peso * alpha) / (distancia * distancia);
      const fx = (dx / distancia) * forca;
      const fy = (dy / distancia) * forca;
      primeiro.vx -= fx;
      primeiro.vy -= fy;
      segundo.vx += fx;
      segundo.vy += fy;
    }
  }

  for (let i = 0; i < estado.ligacoes.length; i += 1) {
    const primeiro = nos[estado.ligacoes[i][0]];
    const segundo = nos[estado.ligacoes[i][1]];
    const dx = segundo.x - primeiro.x;
    const dy = segundo.y - primeiro.y;
    const distancia = Math.max(Math.hypot(dx, dy), DISTANCIA_MINIMA);
    const forca = RIGIDEZ * (distancia - COMPRIMENTO_DA_MOLA) * alpha;
    const fx = (dx / distancia) * forca;
    const fy = (dy / distancia) * forca;
    primeiro.vx += fx;
    primeiro.vy += fy;
    segundo.vx -= fx;
    segundo.vy -= fy;
  }

  for (let i = 0; i < nos.length; i += 1) {
    const no = nos[i];

    // O nó preso ao dedo descarta o que as forças acumularam: quem manda na
    // posição dele é o gesto.
    if (no.fixo) {
      no.vx = 0;
      no.vy = 0;
      continue;
    }

    no.vx += (centroX - no.x) * ATRACAO_AO_CENTRO * alpha;
    no.vy += (centroY - no.y) * ATRACAO_AO_CENTRO * alpha;
    no.vx *= ATRITO;
    no.vy *= ATRITO;
    no.x += no.vx * passo;
    no.y += no.vy * passo;
  }

  estado.alpha = alpha * (1 - DECAIMENTO_DO_ALPHA);
}

export function fixarNo(estado: EstadoSimulacao, id: string, x: number, y: number): void {
  "worklet";
  for (let i = 0; i < estado.nos.length; i += 1) {
    if (estado.nos[i].id !== id) continue;
    estado.nos[i].fixo = true;
    estado.nos[i].x = x;
    estado.nos[i].y = y;
    estado.nos[i].vx = 0;
    estado.nos[i].vy = 0;
    return;
  }
}

export function liberarNo(estado: EstadoSimulacao, id: string): void {
  "worklet";
  for (let i = 0; i < estado.nos.length; i += 1) {
    if (estado.nos[i].id === id) estado.nos[i].fixo = false;
  }
}

export function reaquecer(estado: EstadoSimulacao, alvo: number): void {
  "worklet";
  estado.alpha = Math.max(estado.alpha, alvo);
}

export function esfriou(estado: EstadoSimulacao): boolean {
  "worklet";
  return estado.alpha < ALPHA_MINIMO;
}
