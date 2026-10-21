import type { IdDeNota } from "./types";

/** Tempos em milissegundos. */
export const INTERVALO_ENTRE_CANDIDATAS_MS = 140;
export const DURACAO_DA_IGNICAO_MS = 320;
export const VIAGEM_DA_FAISCA_MS = 700;
export const ECO_DA_ESCRITA_MS = 1400;
export const DESVANECIMENTO_FINAL_MS = 900;
export const RAMPA_DO_ESCURECIMENTO_MS = 300;
/** Quanto o resto do grafo escurece (0..1) enquanto o agente trabalha. */
export const ESCURECIMENTO = 0.55;

const MAX_PASSOS_PADRAO = 6;

export type PassoDoAgente =
  | { tipo: "busca"; ids: IdDeNota[] }
  | { tipo: "leitura"; id: IdDeNota }
  | { tipo: "escrita"; id: IdDeNota; criada: boolean };

type PassoComTempo = PassoDoAgente & { em: number };

export type Rastro = {
  inicio: number;
  passos: ReadonlyArray<PassoComTempo>;
  fim: number | null;
};

export type EstadoDaNota =
  | "candidata"
  | "vista"
  | "lendo"
  | "lida"
  | "escrevendo"
  | "citada"
  | "nova";

export type NotaNoRastro = { estado: EstadoDaNota; intensidade: number; desde: number };
export type SegmentoDoRastro = { ids: IdDeNota[]; progresso: number };

export type QuadroDoRastro = {
  notas: ReadonlyMap<IdDeNota, NotaNoRastro>;
  segmentos: readonly SegmentoDoRastro[];
  faisca: SegmentoDoRastro | null;
  foco: number;
  ativo: boolean;
};

export type BuscadorDeCaminho = (de: IdDeNota, para: IdDeNota) => IdDeNota[] | null;

export function iniciarRastro(agora: number): Rastro {
  return { inicio: agora, passos: [], fim: null };
}

export function registrarPasso(rastro: Rastro, passo: PassoDoAgente, agora: number): Rastro {
  if (rastro.fim !== null) return rastro;
  const copia: PassoDoAgente = passo.tipo === "busca" ? { ...passo, ids: [...passo.ids] } : { ...passo };
  return { ...rastro, passos: [...rastro.passos, { ...copia, em: agora }] };
}

export function encerrarRastro(rastro: Rastro, agora: number): Rastro {
  if (rastro.fim !== null) return rastro;
  return { ...rastro, fim: agora };
}

function limitar(valor: number): number {
  return Math.min(1, Math.max(0, valor));
}

// --- Notas -----------------------------------------------------------------

type Registro = {
  tipo: "candidata" | "vista" | "lida" | "lendo" | "escrita";
  desde: number;
  criada?: boolean;
};

/** Resolve, passo a passo, o que cada nota é, sem olhar o relógio. */
function consolidar(passos: ReadonlyArray<PassoComTempo>): Map<IdDeNota, Registro> {
  const registros = new Map<IdDeNota, Registro>();
  let candidatas: IdDeNota[] = [];
  let ultimaLida: IdDeNota | null = null;

  const promoverCandidatas = (em: number) => {
    for (const id of candidatas) {
      if (registros.get(id)?.tipo === "candidata") registros.set(id, { tipo: "vista", desde: em });
    }
    candidatas = [];
  };

  for (const passo of passos) {
    if (passo.tipo === "busca") {
      passo.ids.forEach((id, i) => {
        const atual = registros.get(id)?.tipo;
        if (atual && atual !== "candidata" && atual !== "vista") return;
        registros.set(id, { tipo: "candidata", desde: passo.em + i * INTERVALO_ENTRE_CANDIDATAS_MS });
        candidatas.push(id);
      });
      continue;
    }
    promoverCandidatas(passo.em);
    if (passo.tipo === "leitura") {
      registros.set(passo.id, { tipo: "lida", desde: passo.em });
      ultimaLida = passo.id;
    } else {
      registros.set(passo.id, { tipo: "escrita", desde: passo.em, criada: passo.criada });
      ultimaLida = null;
    }
  }

  const lida = ultimaLida === null ? undefined : registros.get(ultimaLida);
  if (ultimaLida !== null && lida) registros.set(ultimaLida, { ...lida, tipo: "lendo" });
  return registros;
}

function projetarEscrita(registro: Registro, agora: number): NotaNoRastro {
  const fimDoEco = registro.desde + ECO_DA_ESCRITA_MS;
  if (agora < fimDoEco) return { estado: "escrevendo", intensidade: 1, desde: registro.desde };
  return { estado: registro.criada ? "nova" : "citada", intensidade: 1, desde: fimDoEco };
}

function projetarNota(registro: Registro, agora: number, fim: number | null): NotaNoRastro | null {
  if (registro.tipo === "escrita") return projetarEscrita(registro, agora);
  if (registro.tipo === "lida" || registro.tipo === "lendo") {
    const encerrado = fim !== null && agora >= fim;
    return encerrado
      ? { estado: "citada", intensidade: 1, desde: fim }
      : { estado: registro.tipo, intensidade: 1, desde: registro.desde };
  }
  const acendimento =
    registro.tipo === "candidata" ? limitar((agora - registro.desde) / DURACAO_DA_IGNICAO_MS) : 1;
  const apagamento = fim === null ? 1 : 1 - limitar((agora - fim) / DESVANECIMENTO_FINAL_MS);
  if (apagamento <= 0) return null;
  return { estado: registro.tipo, intensidade: Math.min(acendimento, apagamento), desde: registro.desde };
}

function notasDoRastro(rastro: Rastro, agora: number): Map<IdDeNota, NotaNoRastro> {
  const notas = new Map<IdDeNota, NotaNoRastro>();
  for (const [id, registro] of consolidar(rastro.passos)) {
    const nota = projetarNota(registro, agora, rastro.fim);
    if (nota) notas.set(id, nota);
  }
  return notas;
}

// --- Caminho percorrido ----------------------------------------------------

/** Notas tocadas (lidas ou escritas) em ordem, sem repetições consecutivas. */
function notasTocadas(passos: ReadonlyArray<PassoComTempo>): Array<{ id: IdDeNota; em: number }> {
  const tocadas: Array<{ id: IdDeNota; em: number }> = [];
  for (const passo of passos) {
    if (passo.tipo === "busca") continue;
    if (tocadas[tocadas.length - 1]?.id === passo.id) continue;
    tocadas.push({ id: passo.id, em: passo.em });
  }
  return tocadas;
}

function segmentosDoRastro(
  rastro: Rastro,
  agora: number,
  caminho?: BuscadorDeCaminho,
): SegmentoDoRastro[] {
  const tocadas = notasTocadas(rastro.passos);
  const segmentos: SegmentoDoRastro[] = [];
  for (let i = 1; i < tocadas.length; i++) {
    const de = tocadas[i - 1].id;
    const para = tocadas[i];
    const achado = caminho?.(de, para.id);
    segmentos.push({
      ids: achado && achado.length >= 2 ? [...achado] : [de, para.id],
      progresso: limitar((agora - para.em) / VIAGEM_DA_FAISCA_MS),
    });
  }
  return segmentos;
}

// --- Foco e atividade ------------------------------------------------------

/** O escurecimento começa no primeiro passo e se desfaz depois do fim. */
function focoDoRastro(rastro: Rastro, agora: number): number {
  if (rastro.passos.length === 0) return 1;
  const subida = limitar((agora - rastro.passos[0].em) / RAMPA_DO_ESCURECIMENTO_MS);
  const descida = rastro.fim === null ? 1 : 1 - limitar((agora - rastro.fim) / DESVANECIMENTO_FINAL_MS);
  return 1 - ESCURECIMENTO * subida * descida;
}

function fimDaUltimaAnimacao(passos: ReadonlyArray<PassoComTempo>): number {
  let ultimo = 0;
  for (const passo of passos) {
    const duracao =
      passo.tipo === "busca"
        ? Math.max(0, passo.ids.length - 1) * INTERVALO_ENTRE_CANDIDATAS_MS + DURACAO_DA_IGNICAO_MS
        : passo.tipo === "escrita"
          ? Math.max(ECO_DA_ESCRITA_MS, VIAGEM_DA_FAISCA_MS)
          : VIAGEM_DA_FAISCA_MS;
    ultimo = Math.max(ultimo, passo.em + duracao);
  }
  return ultimo;
}

function estaAtivo(rastro: Rastro, agora: number): boolean {
  if (rastro.fim === null) return true;
  const termina = Math.max(rastro.fim + DESVANECIMENTO_FINAL_MS, fimDaUltimaAnimacao(rastro.passos));
  return agora < termina;
}

const QUADRO_VAZIO: QuadroDoRastro = {
  notas: new Map(),
  segmentos: [],
  faisca: null,
  foco: 1,
  ativo: false,
};

/** Tudo o que o grafo deve mostrar no instante `agora`. Barato: O(passos + notas tocadas). */
export function quadroDoRastro(
  rastro: Rastro | null,
  agora: number,
  caminho?: BuscadorDeCaminho,
): QuadroDoRastro {
  if (!rastro) return QUADRO_VAZIO;
  const segmentos = segmentosDoRastro(rastro, agora, caminho);
  const ultimo = segmentos[segmentos.length - 1];
  return {
    notas: notasDoRastro(rastro, agora),
    segmentos,
    faisca: ultimo && ultimo.progresso < 1 ? ultimo : null,
    foco: focoDoRastro(rastro, agora),
    ativo: estaAtivo(rastro, agora),
  };
}

// --- Busca de caminho ------------------------------------------------------

/** Busca em largura num mapa de vizinhança não direcionado. `null` se passar de `maxPassos` saltos. */
export function caminhoMaisCurto(
  vizinhos: ReadonlyMap<string, ReadonlySet<string>>,
  de: string,
  para: string,
  maxPassos: number = MAX_PASSOS_PADRAO,
): string[] | null {
  if (de === para) return [de];
  const veioDe = new Map<string, string>();
  const visitadas = new Set<string>([de]);
  let fronteira = [de];
  for (let saltos = 1; saltos <= maxPassos && fronteira.length > 0; saltos++) {
    const proxima: string[] = [];
    for (const atual of fronteira) {
      for (const vizinha of vizinhos.get(atual) ?? []) {
        if (visitadas.has(vizinha)) continue;
        visitadas.add(vizinha);
        veioDe.set(vizinha, atual);
        if (vizinha === para) return reconstruir(veioDe, de, para);
        proxima.push(vizinha);
      }
    }
    fronteira = proxima;
  }
  return null;
}

function reconstruir(veioDe: ReadonlyMap<string, string>, de: string, para: string): string[] {
  const caminho = [para];
  for (let atual = para; atual !== de; ) {
    atual = veioDe.get(atual) as string;
    caminho.push(atual);
  }
  return caminho.reverse();
}
