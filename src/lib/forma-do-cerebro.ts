/**
 * Forma do cérebro: transforma as posições do globo (layout de força) em
 * posições-alvo que desenham um cérebro de perfil, virado para a esquerda.
 * Módulo puro (sem DOM nem React): o canvas interpola entre as duas formas.
 *
 * Passos: silhueta -> vagas (contorno, sulcos, miolo) -> atribuição nó→vaga
 * (vizinhos do globo ficam perto no cérebro) -> arestas só de desenho.
 */

export type PontoDoCerebro = { x: number; y: number };
export type TipoDeArestaDoCerebro = "contorno" | "sulco" | "malha";
export type ArestaDoCerebro = { de: string; para: string; tipo: TipoDeArestaDoCerebro };
export type FormaDoCerebro = {
  alvos: ReadonlyMap<string, PontoDoCerebro>;
  arestas: readonly ArestaDoCerebro[];
  atrasos: ReadonlyMap<string, number>;
  naBorda: ReadonlySet<string>;
};

export const ATRASO_MAXIMO = 0.3;

const SEMENTE_PADRAO = 1337;
const LARGURA_DO_CEREBRO = 182;
const CENTRO = { x: 103, y: 88.5 };
const CAIXA = { minX: 12, maxX: 194, minY: 5, maxY: 172 };

const SILHUETA: readonly PontoDoCerebro[] = [
  [12, 80], [14, 62], [22, 44], [36, 28], [54, 16], [76, 8], [100, 5], [124, 6],
  [146, 12], [166, 24], [182, 42], [192, 62], [194, 82], [188, 100], [176, 110],
  [186, 120], [182, 136], [166, 146], [148, 146], [136, 140], [134, 156], [132, 172],
  [120, 172], [120, 154], [118, 136], [100, 134], [80, 130], [62, 122], [48, 110],
  [46, 100], [54, 92], [40, 96], [26, 96], [16, 90],
].map(([x, y]) => ({ x, y }));

const SULCOS: readonly (readonly PontoDoCerebro[])[] = [
  [[66, 88], [80, 84], [96, 82], [112, 86], [126, 94]],
  [[104, 22], [100, 40], [96, 58], [93, 72]],
  [[164, 114], [150, 120], [138, 128]],
  [[38, 50], [52, 62], [62, 76]],
  [[140, 30], [140, 50], [150, 70]],
].map((cadeia) => cadeia.map(([x, y]) => ({ x, y })));

const MINIMO_DE_NOS_PARA_SULCOS = 60;
const ESPACAMENTO_NATURAL = 13;
const NOS_NO_ESPACAMENTO_NATURAL = 120;
const FRACAO_DO_CONTORNO = 0.4;
const ESPACAMENTO_MINIMO_DO_CONTORNO = 5;
const ESPACAMENTO_MINIMO_DO_SULCO = 6;
const DISTANCIA_MINIMA_ENTRE_VAGAS = 2;
const CANDIDATOS_DO_MIOLO = 30;
const ALCANCE_DO_SULCO = 22;
const ALCANCE_DA_MALHA = 24;
const VIZINHOS_DA_MALHA = 3;

type TipoDeVaga = "contorno" | "sulco" | "miolo";
type Vaga = PontoDoCerebro & { tipo: TipoDeVaga; cadeia: number };
type Vagas = { vagas: Vaga[]; contorno: number[]; cadeias: number[][] };

function criarAleatorio(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

function distancia(a: PontoDoCerebro, b: PontoDoCerebro): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Ponto dentro do polígono, por lançamento de raio. */
function dentroDaSilhueta(p: PontoDoCerebro): boolean {
  let dentro = false;
  for (let i = 0, j = SILHUETA.length - 1; i < SILHUETA.length; j = i++) {
    const a = SILHUETA[i];
    const b = SILHUETA[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

function lado(p: PontoDoCerebro, q: PontoDoCerebro, r: PontoDoCerebro): number {
  return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
}

function cruzaABorda(a: PontoDoCerebro, b: PontoDoCerebro): boolean {
  return SILHUETA.some((c, i) => {
    const d = SILHUETA[(i + 1) % SILHUETA.length];
    return lado(a, b, c) * lado(a, b, d) < 0 && lado(c, d, a) * lado(c, d, b) < 0;
  });
}

/** O segmento fica dentro da silhueta: três amostras dentro e nenhum cruzamento com a borda. */
function segmentoDentro(a: PontoDoCerebro, b: PontoDoCerebro): boolean {
  const amostrasDentro = [0.25, 0.5, 0.75].every((t) =>
    dentroDaSilhueta({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  );
  return amostrasDentro && !cruzaABorda(a, b);
}

/** Reamostra uma polilinha (aberta ou fechada) em `quantidade` pontos por comprimento de arco. */
function reamostrar(pontos: readonly PontoDoCerebro[], quantidade: number, fechada: boolean): PontoDoCerebro[] {
  const caminho = fechada ? [...pontos, pontos[0]] : pontos;
  const acumulado = [0];
  for (let i = 1; i < caminho.length; i++) acumulado.push(acumulado[i - 1] + distancia(caminho[i - 1], caminho[i]));
  const total = acumulado[acumulado.length - 1];
  const passos = fechada ? quantidade : quantidade - 1;
  const resultado: PontoDoCerebro[] = [];
  let trecho = 1;
  for (let k = 0; k < quantidade; k++) {
    const alvo = passos > 0 ? (total * k) / passos : 0;
    while (trecho < caminho.length - 1 && acumulado[trecho] < alvo) trecho++;
    const inicio = acumulado[trecho - 1];
    const comprimento = acumulado[trecho] - inicio;
    const t = comprimento > 0 ? limitar((alvo - inicio) / comprimento, 0, 1) : 0;
    const a = caminho[trecho - 1];
    const b = caminho[trecho];
    resultado.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return resultado;
}

function comprimento(pontos: readonly PontoDoCerebro[], fechada: boolean): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) total += distancia(pontos[i - 1], pontos[i]);
  return fechada ? total + distancia(pontos[pontos.length - 1], pontos[0]) : total;
}

function quantidadeNoContorno(nos: number): number {
  const maximo = Math.round(comprimento(SILHUETA, true) / ESPACAMENTO_MINIMO_DO_CONTORNO);
  const minimo = Math.min(nos, 3);
  return limitar(Math.round(nos * FRACAO_DO_CONTORNO), minimo, Math.max(minimo, Math.min(nos, maximo)));
}

function pontosDosSulcos(nos: number): PontoDoCerebro[][] {
  if (nos < MINIMO_DE_NOS_PARA_SULCOS) return [];
  const espacamento = Math.max(
    ESPACAMENTO_MINIMO_DO_SULCO,
    ESPACAMENTO_NATURAL * Math.sqrt(NOS_NO_ESPACAMENTO_NATURAL / nos),
  );
  return SULCOS.map((cadeia) =>
    reamostrar(cadeia, Math.max(2, Math.round(comprimento(cadeia, false) / espacamento) + 1), false),
  );
}

/** Menor distância ao quadrado até as vagas; para cedo ao ficar abaixo de `corte` (já não seria melhor). */
function menorDistanciaAoQuadrado(p: PontoDoCerebro, vagas: readonly Vaga[], corte = 0): number {
  let menor = Infinity;
  for (let i = 0; i < vagas.length; i++) {
    const d = (vagas[i].x - p.x) ** 2 + (vagas[i].y - p.y) ** 2;
    if (d < menor) {
      menor = d;
      if (menor < corte) return menor;
    }
  }
  return menor;
}

function sortearDentro(aleatorio: () => number): PontoDoCerebro {
  for (;;) {
    const p = {
      x: CAIXA.minX + aleatorio() * (CAIXA.maxX - CAIXA.minX),
      y: CAIXA.minY + aleatorio() * (CAIXA.maxY - CAIXA.minY),
    };
    if (dentroDaSilhueta(p)) return p;
  }
}

/** "Melhor candidato": entre alguns sorteios, fica o ponto mais longe de todas as vagas. */
function melhorCandidato(vagas: readonly Vaga[], aleatorio: () => number): PontoDoCerebro {
  let melhor = sortearDentro(aleatorio);
  let folga = menorDistanciaAoQuadrado(melhor, vagas);
  for (let i = 1; i < CANDIDATOS_DO_MIOLO; i++) {
    const candidato = sortearDentro(aleatorio);
    const f = menorDistanciaAoQuadrado(candidato, vagas, folga);
    if (f > folga) {
      melhor = candidato;
      folga = f;
    }
  }
  return melhor;
}

/** Uma vaga por nó: contorno uniforme, sulcos (se houver nós de sobra) e miolo. */
function gerarVagas(nos: number, semente: number): Vagas {
  const vagas: Vaga[] = [];
  const contorno: number[] = [];
  const cadeias: number[][] = [];
  const aleatorio = criarAleatorio(semente);

  for (const p of reamostrar(SILHUETA, quantidadeNoContorno(nos), true)) {
    contorno.push(vagas.length);
    vagas.push({ ...p, tipo: "contorno", cadeia: -1 });
  }
  for (const pontos of pontosDosSulcos(nos)) {
    const indices: number[] = [];
    for (const p of pontos) {
      const livre = menorDistanciaAoQuadrado(p, vagas) >= DISTANCIA_MINIMA_ENTRE_VAGAS ** 2;
      if (vagas.length >= nos || !livre || !dentroDaSilhueta(p)) continue;
      indices.push(vagas.length);
      vagas.push({ ...p, tipo: "sulco", cadeia: cadeias.length });
    }
    cadeias.push(indices);
  }
  while (vagas.length < nos) vagas.push({ ...melhorCandidato(vagas, aleatorio), tipo: "miolo", cadeia: -1 });
  return { vagas, contorno, cadeias };
}

type Caixa = { minX: number; maxX: number; minY: number; maxY: number };

function caixaDe(pontos: ReadonlyArray<PontoDoCerebro>): Caixa {
  const xs = pontos.map((p) => p.x);
  const ys = pontos.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function normalizar(valor: number, minimo: number, maximo: number): number {
  return maximo > minimo ? (valor - minimo) / (maximo - minimo) : 0.5;
}

/** Posição de cada nó dentro da caixa do cérebro, na ordem de entrada. */
function nosNaCaixaDoCerebro(nos: ReadonlyArray<PontoDoCerebro>): PontoDoCerebro[] {
  const caixa = caixaDe(nos);
  return nos.map((n) => ({
    x: CAIXA.minX + normalizar(n.x, caixa.minX, caixa.maxX) * (CAIXA.maxX - CAIXA.minX),
    y: CAIXA.minY + normalizar(n.y, caixa.minY, caixa.maxY) * (CAIXA.maxY - CAIXA.minY),
  }));
}

/** Guloso de fora para dentro: cada nó fica com a vaga livre mais próxima. Devolve vaga por índice de nó. */
function atribuirVagas(nos: ReadonlyArray<PontoDoCerebro>, vagas: readonly Vaga[]): number[] {
  const posicoes = nosNaCaixaDoCerebro(nos);
  const raio = (p: PontoDoCerebro) =>
    Math.hypot((p.x - CENTRO.x) / ((CAIXA.maxX - CAIXA.minX) / 2), (p.y - CENTRO.y) / ((CAIXA.maxY - CAIXA.minY) / 2));
  const ordem = posicoes.map((_, i) => i).sort((a, b) => raio(posicoes[b]) - raio(posicoes[a]) || a - b);
  const ocupada = new Array<boolean>(vagas.length).fill(false);
  const vagaDoNo = new Array<number>(nos.length).fill(-1);
  for (const i of ordem) {
    let melhor = -1;
    let menor = Infinity;
    for (let v = 0; v < vagas.length; v++) {
      if (ocupada[v]) continue;
      const d = (vagas[v].x - posicoes[i].x) ** 2 + (vagas[v].y - posicoes[i].y) ** 2;
      if (d < menor) {
        menor = d;
        melhor = v;
      }
    }
    ocupada[melhor] = true;
    vagaDoNo[i] = melhor;
  }
  return vagaDoNo;
}

type ArestaDeVagas = { de: number; para: number; tipo: TipoDeArestaDoCerebro };

class ConjuntoDeArestas {
  readonly itens: ArestaDeVagas[] = [];
  private readonly vistas = new Set<string>();

  adicionar(de: number, para: number, tipo: TipoDeArestaDoCerebro): void {
    if (de === para) return;
    const chave = de < para ? `${de}|${para}` : `${para}|${de}`;
    if (this.vistas.has(chave)) return;
    this.vistas.add(chave);
    this.itens.push({ de, para, tipo });
  }
}

function ligarContorno(contorno: readonly number[], arestas: ConjuntoDeArestas): void {
  contorno.forEach((v, i) => arestas.adicionar(v, contorno[(i + 1) % contorno.length], "contorno"));
}

function ligarSulcos({ vagas, cadeias }: Vagas, arestas: ConjuntoDeArestas): void {
  cadeias.forEach((cadeia, numero) => {
    for (let i = 1; i < cadeia.length; i++) arestas.adicionar(cadeia[i - 1], cadeia[i], "sulco");
    for (const ponta of cadeia.length > 0 ? [cadeia[0], cadeia[cadeia.length - 1]] : []) {
      let melhor = -1;
      let menor = ALCANCE_DO_SULCO;
      vagas.forEach((outra, v) => {
        if (outra.tipo === "miolo" || outra.cadeia === numero) return;
        const d = distancia(vagas[ponta], outra);
        if (d <= menor && segmentoDentro(vagas[ponta], outra)) {
          menor = d;
          melhor = v;
        }
      });
      if (melhor >= 0) arestas.adicionar(ponta, melhor, "sulco");
    }
  });
}

function ligarMalha(vagas: readonly Vaga[], arestas: ConjuntoDeArestas): void {
  vagas.forEach((vaga, i) => {
    const proximas: { j: number; d: number }[] = [];
    for (let j = 0; j < vagas.length; j++) {
      const d = (vagas[j].x - vaga.x) ** 2 + (vagas[j].y - vaga.y) ** 2;
      if (j !== i && d <= ALCANCE_DA_MALHA ** 2) proximas.push({ j, d });
    }
    proximas.sort((a, b) => a.d - b.d || a.j - b.j);
    let ligadas = 0;
    for (const { j } of proximas) {
      if (ligadas >= VIZINHOS_DA_MALHA) break;
      if (!segmentoDentro(vaga, vagas[j])) continue;
      arestas.adicionar(i, j, "malha");
      ligadas++;
    }
  });
}

function montarArestasDeVagas(todas: Vagas): ArestaDeVagas[] {
  const arestas = new ConjuntoDeArestas();
  ligarContorno(todas.contorno, arestas);
  ligarSulcos(todas, arestas);
  ligarMalha(todas.vagas, arestas);
  return arestas.itens;
}

/** Cérebro (coordenadas próprias) -> coordenadas do mundo, com a largura do cérebro ≈ diâmetro do globo. */
function paraOMundo(nos: ReadonlyArray<PontoDoCerebro>): (p: PontoDoCerebro) => PontoDoCerebro {
  const caixa = caixaDe(nos);
  const lado = Math.max(caixa.maxX - caixa.minX, caixa.maxY - caixa.minY);
  const escala = lado > 0 ? lado / LARGURA_DO_CEREBRO : 1;
  const cx = (caixa.minX + caixa.maxX) / 2;
  const cy = (caixa.minY + caixa.maxY) / 2;
  return (p) => ({ x: cx + (p.x - CENTRO.x) * escala, y: cy + (p.y - CENTRO.y) * escala });
}

export function montarFormaDoCerebro(
  nos: ReadonlyArray<{ id: string; x: number; y: number }>,
  opcoes: { semente?: number } = {},
): FormaDoCerebro {
  const alvos = new Map<string, PontoDoCerebro>();
  const atrasos = new Map<string, number>();
  const naBorda = new Set<string>();
  if (nos.length === 0) return { alvos, arestas: [], atrasos, naBorda };

  const todas = gerarVagas(nos.length, opcoes.semente ?? SEMENTE_PADRAO);
  const vagaDoNo = atribuirVagas(nos, todas.vagas);
  const idDaVaga = new Array<string>(todas.vagas.length);
  const mundo = paraOMundo(nos);

  nos.forEach((no, i) => {
    const vaga = todas.vagas[vagaDoNo[i]];
    idDaVaga[vagaDoNo[i]] = no.id;
    alvos.set(no.id, mundo(vaga));
    atrasos.set(no.id, limitar(normalizar(vaga.x, CAIXA.minX, CAIXA.maxX), 0, 1) * ATRASO_MAXIMO);
    if (vaga.tipo !== "miolo") naBorda.add(no.id);
  });

  const arestas = montarArestasDeVagas(todas).map(({ de, para, tipo }) => ({
    de: idDaVaga[de],
    para: idDaVaga[para],
    tipo,
  }));
  return { alvos, arestas, atrasos, naBorda };
}

function suavizar(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Progresso de um nó dado o progresso geral (0 = globo, 1 = cérebro) e o atraso dele. */
export function progressoDoNo(progressoGeral: number, atraso: number): number {
  const atrasoValido = limitar(atraso, 0, ATRASO_MAXIMO);
  return suavizar(limitar((progressoGeral - atrasoValido) / (1 - ATRASO_MAXIMO), 0, 1));
}
