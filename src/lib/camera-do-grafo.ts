/**
 * Matemática da "câmera" do grafo: o que transforma o espaço da simulação
 * (onde os nós vivem) em pixels de tela, e o contrário. Tudo aqui é puro e
 * imutável — cada função devolve uma câmera nova —, o que deixa o zoom, o
 * arrastar e o enquadramento testáveis sem canvas.
 *
 * Convenção: `tela = mundo * k + (x, y)`. `k` é a escala (zoom) e `(x, y)` é
 * onde a origem do mundo cai na tela, em pixels.
 */

export type Ponto = { x: number; y: number };
export type Camera = { x: number; y: number; k: number };
export type Caixa = { minX: number; maxX: number; minY: number; maxY: number };
export type LimitesDeZoom = { min: number; max: number };

/** Quanto dá para aproximar, em escala absoluta (1 = tamanho real da simulação). */
export const ZOOM_MAXIMO = 4;
/** O mínimo é uma fração do enquadramento: dá para afastar um pouco além de "tudo na tela". */
const FRACAO_MINIMA_DO_ENQUADRAMENTO = 0.5;

/**
 * Piso do raio na tela, proporcional ao tamanho do nó. Com as forças do
 * Obsidian o layout ocupa milhares de unidades, e o enquadramento afasta
 * tanto (escala ~0,06 com ~400 notas) que todo nó viraria um ponto de
 * 1 px — os hubs sumiriam. Com o piso, afastado um nó de raio 8 fica com
 * ~1,4 px e um de raio 30 com ~5,4 px; de perto, vale a escala real.
 */
const PISO_DO_RAIO_NA_TELA = 0.18;
/** Raio mínimo na tela — mantém tudo visível e clicável mesmo bem afastado. */
const RAIO_MINIMO_NA_TELA = 1.2;
/** Diferença abaixo da qual duas câmeras contam como a mesma (para parar de animar). */
const TOLERANCIA_EM_PIXELS = 0.5;
const TOLERANCIA_DA_ESCALA = 0.001;

export function mundoParaTela(camera: Camera, ponto: Ponto): Ponto {
  return { x: ponto.x * camera.k + camera.x, y: ponto.y * camera.k + camera.y };
}

export function telaParaMundo(camera: Camera, ponto: Ponto): Ponto {
  return { x: (ponto.x - camera.x) / camera.k, y: (ponto.y - camera.y) / camera.k };
}

/** Desloca a câmera em pixels de tela (arrastar o fundo). */
export function arrastar(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

function limitar(valor: number, { min, max }: LimitesDeZoom): number {
  return Math.min(max, Math.max(min, valor));
}

/**
 * Multiplica o zoom por `fator`, mantendo parado o ponto de tela `ponto` — o
 * que está sob o cursor (ou entre os dedos) continua sob ele.
 */
export function zoomEmTorno(
  camera: Camera,
  ponto: Ponto,
  fator: number,
  limites: LimitesDeZoom,
): Camera {
  const k = limitar(camera.k * fator, limites);
  if (k === camera.k) return camera;

  const razao = k / camera.k;
  return {
    k,
    x: ponto.x - (ponto.x - camera.x) * razao,
    y: ponto.y - (ponto.y - camera.y) * razao,
  };
}

/** `kEnquadrado` é a escala que faz o grafo inteiro caber na tela. */
export function limitesDeZoom(kEnquadrado: number): LimitesDeZoom {
  return {
    min: kEnquadrado * FRACAO_MINIMA_DO_ENQUADRAMENTO,
    max: Math.max(ZOOM_MAXIMO, kEnquadrado),
  };
}

export function calcularCaixa(pontos: readonly Ponto[]): Caixa | null {
  if (pontos.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { x, y } of pontos) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

export type OpcoesDeEnquadramento = {
  /** Folga somada à caixa, em unidades do mundo — para os nós das bordas não serem cortados. */
  margem: number;
  /** Fração da tela que o conteúdo pode ocupar (0 a 1); o resto é respiro. */
  ocupacao: number;
  /** Teto da escala: 1 só afasta, nunca amplia um grafo pequeno. */
  zoomMaximo: number;
};

/** A câmera que põe a caixa inteira no meio da tela. */
export function enquadrar(
  caixa: Caixa,
  largura: number,
  altura: number,
  { margem, ocupacao, zoomMaximo }: OpcoesDeEnquadramento,
): Camera {
  const larguraDoMundo = Math.max(caixa.maxX - caixa.minX + margem, 1);
  const alturaDoMundo = Math.max(caixa.maxY - caixa.minY + margem, 1);
  const k = Math.min(
    zoomMaximo,
    (largura * ocupacao) / larguraDoMundo,
    (altura * ocupacao) / alturaDoMundo,
  );

  const centro = { x: (caixa.minX + caixa.maxX) / 2, y: (caixa.minY + caixa.maxY) / 2 };
  return { k, x: largura / 2 - centro.x * k, y: altura / 2 - centro.y * k };
}

export function interpolar(de: Camera, para: Camera, t: number): Camera {
  return {
    x: de.x + (para.x - de.x) * t,
    y: de.y + (para.y - de.y) * t,
    k: de.k + (para.k - de.k) * t,
  };
}

export function quaseIgual(a: Camera, b: Camera): boolean {
  return (
    Math.abs(a.x - b.x) < TOLERANCIA_EM_PIXELS &&
    Math.abs(a.y - b.y) < TOLERANCIA_EM_PIXELS &&
    Math.abs(a.k - b.k) < TOLERANCIA_DA_ESCALA * Math.max(b.k, 1e-6)
  );
}

/** Raio desenhado de um nó, dado o raio da simulação e o zoom atual. */
export function raioNaTela(raioDoNo: number, k: number): number {
  return Math.max(raioDoNo * k, raioDoNo * PISO_DO_RAIO_NA_TELA, RAIO_MINIMO_NA_TELA);
}

/**
 * O nó sob o ponto de tela. Afastado, nós vizinhos ficam a poucos pixels e as
 * áreas de toque se sobrepõem — então devolve o mais próximo do ponto, não o
 * primeiro da lista. `margem` alarga a área (dedo é mais grosso que cursor).
 */
export function encontrarNoEm<T extends Ponto>(
  nos: readonly T[],
  camera: Camera,
  ponto: Ponto,
  raioNaTelaDe: (no: T) => number,
  margem: number,
): T | null {
  let melhor: T | null = null;
  let menorDistancia2 = Infinity;

  for (const no of nos) {
    const naTela = mundoParaTela(camera, no);
    const distancia2 = (naTela.x - ponto.x) ** 2 + (naTela.y - ponto.y) ** 2;
    const alcance = raioNaTelaDe(no) + margem;
    if (distancia2 <= alcance ** 2 && distancia2 < menorDistancia2) {
      melhor = no;
      menorDistancia2 = distancia2;
    }
  }
  return melhor;
}
