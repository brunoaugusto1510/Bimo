import { normalizarTexto } from "../caminho-da-nota";
import type { RepositorioDeNotas, ResumoDeNota } from "../repositorio-de-notas/tipos";
import type { CandidataWiki, ConceitoWiki, IndiceWiki } from "./automacao-tipos";
import { garantirIds } from "./afirmacoes";
import { fonteConfere } from "./fontes";
import type { FonteWiki } from "./tipos";

/** Sínteses desatualizadas por esta origem entram primeiro, em ondas pequenas. */
export const DEPENDENTES_POR_ONDA = 3;
export const CANDIDATAS_POR_RODADA = 8;
/** Quanto da pontuação de um neurônio passa aos vizinhos: a rede traz o que a busca por palavras não alcança. */
const PESO_DO_VIZINHO = 0.5;
/** Termos consultados no acervo, no mínimo; termos só da própria nota não recuperam nada e não contam como úteis. */
export const TERMOS_PRELIMINARES = 10;
const TERMOS_UTEIS_MINIMOS = 3;
/** Teto de consultas por nota, mesmo quando os termos mais salientes só existem nela. */
export const TERMOS_MAXIMOS = 20;
export const TERMOS_FINAIS = 6;
/**
 * Basta saber se o termo é comum: a partir daqui a frequência exata não muda a pontuação, e a consulta custa menos.
 * A consulta pede um a mais, para que a própria nota não esconda a saturação.
 */
export const LIMITE_DA_CONSULTA_DE_TERMO = 20;
const ENTRADAS_NO_INDICE = 250;
const ALIASES_NO_INDICE = 6;
const RESUMO_NO_INDICE = 160;
/** Em caracteres da serialização; o payload inteiro tem seu próprio teto (e corta o fim do índice antes de recusar). */
const TAMANHO_DO_INDICE = 30_000;

// Normalizadas (sem acento). Palavras de função e verbos auxiliares que não distinguem uma nota de outra.
const PALAVRAS_COMUNS = new Set(`
  para com uma uns umas por mais mas como que dos das nos nas pelo pela pelos pelas esse essa esses essas este esta estes estas
  isso isto aquele aquela aquilo aqui ali seu sua seus suas meu minha nosso nossa ele ela eles elas voce voces ser estar ter haver
  fazer foi era sao estao tem tinha tambem muito muita muitos muitas pouco pouca ainda quando onde porque porem entre sobre ate apos
  antes depois durante cada todo toda todos todas outro outra outros outras mesmo mesma apenas somente assim entao pois logo pode
  podem podia deve devem dever vai vao fica ficar sendo sido sera seria nao sim talvez algo algum alguma alguns algumas nada
  ninguem nenhum nenhuma coisa coisas vez vezes ja so la sem sob tudo
`.split(/\s+/).filter(Boolean));

export type TermoPesado = { termo: string; peso: number };
export type TermoPontuado = TermoPesado & { idf: number; pontuacao: number };

/** Termo que ajuda a distinguir a nota: tem letra, não é palavra comum e é longo ou é uma sigla (TCP, UDP). */
function eTermoUtil(bruto: string, termo: string) {
  if (!/\p{L}/u.test(termo) || PALAVRAS_COMUNS.has(termo)) return false;
  return termo.length >= 4 || (termo.length === 3 && bruto === bruto.toUpperCase());
}

/**
 * Termos candidatos da nota, do mais saliente ao menos: o que ela repete, o que está no título e o que é longo.
 * Ainda não sabe nada do acervo; a raridade entra em `pontuarTermos`.
 */
export function ordenarTermos(titulo: string, texto: string): TermoPesado[] {
  const frequencia = new Map<string, number>();
  const contar = (fonte: string, peso: number) => {
    // NFC antes da extração: "quórum" (decomposto) e "quórum" são o mesmo termo.
    for (const bruto of fonte.normalize("NFC").match(/\p{L}[\p{L}\p{N}]*/gu) ?? []) {
      const termo = normalizarTexto(bruto);
      if (eTermoUtil(bruto, termo)) frequencia.set(termo, (frequencia.get(termo) ?? 0) + peso);
    }
  };
  contar(texto, 1); contar(titulo, 2);
  return [...frequencia]
    .map(([termo, tf]) => ({ termo, peso: 1 + Math.log(tf) + (termo.length >= 8 ? 0.5 : 0) }))
    .sort((a, b) => b.peso - a.peso || b.termo.length - a.termo.length || a.termo.localeCompare(b.termo))
    .slice(0, TERMOS_MAXIMOS);
}

/**
 * Saliência na nota × raridade no acervo. `frequencias` é em quantas outras notas o termo aparece (cortado em
 * `LIMITE_DA_CONSULTA_DE_TERMO`); termo que só existe na própria nota não recupera nada e sai.
 */
export function pontuarTermos(preliminares: TermoPesado[], frequencias: Map<string, number>, totalDeNotas: number): TermoPontuado[] {
  return preliminares
    .flatMap((t) => {
      const df = frequencias.get(t.termo) ?? 0;
      if (df <= 0) return [];
      // O universo são as outras notas: a própria nota não conta, nem para o total nem para a frequência.
      const outras = Math.max(totalDeNotas - 1, 0);
      // Suavizado (como no BM25): sempre positivo, então num acervo de duas notas um termo comum ainda recupera a outra.
      const bruto = Math.log(1 + (Math.max(outras - df, 0) + 0.5) / (df + 0.5));
      // Termo saturado na consulta aparece em muitas notas, e não dá para saber quantas: vale como comum, não como raro.
      const idf = df >= LIMITE_DA_CONSULTA_DE_TERMO ? Math.min(Math.LN2, bruto) : bruto;
      return idf > 0 ? [{ ...t, idf, pontuacao: t.peso * idf }] : [];
    })
    .sort((a, b) => b.pontuacao - a.pontuacao || a.termo.localeCompare(b.termo))
    .slice(0, TERMOS_FINAIS);
}

const PLURAIS = ["s", "es", "as", "os", "ns"];
/** Igual, ou só o plural simples de um lado: "cache" e "caches", mas não "cache" e "cachecol" nem "teste" e "testemunho". */
export const casa = (palavra: string, termo: string) => {
  if (palavra === termo) return true;
  const [curta, longa] = palavra.length <= termo.length ? [palavra, termo] : [termo, palavra];
  return curta.length >= 4 && PLURAIS.some((sufixo) => longa === curta + sufixo);
};

const palavrasDe = (texto: string) => (normalizarTexto(texto).match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((p) => !PALAVRAS_COMUNS.has(p));

/** Comparador que tokeniza o texto de referência uma vez: alguma palavra (4+ letras) do outro texto casa com alguma dele? */
export function comPalavrasDe(referencia: string) {
  const dela = palavrasDe(referencia);
  return (outro: string) => palavrasDe(outro).some((p) => dela.some((q) => casa(p, q)));
}

/**
 * Comparador para uma pergunta curta: algum termo dela (palavra não comum de 3+ letras, para que "tcp", "dns" e "api"
 * contem mesmo em minúsculas) casa com alguma palavra inteira do texto? `null` quando a pergunta não tem termo útil.
 */
export function comTermosDe(consulta: string) {
  const termos = (consulta.normalize("NFC").match(/\p{L}[\p{L}\p{N}]*/gu) ?? [])
    .flatMap((bruto) => { const termo = normalizarTexto(bruto); return termo.length >= 3 && !PALAVRAS_COMUNS.has(termo) ? [termo] : []; });
  if (!termos.length) return null;
  return (texto: string) => {
    const palavras = normalizarTexto(texto).match(/[\p{L}\p{N}]+/gu) ?? [];
    return termos.some((t) => palavras.some((p) => casa(p, t)));
  };
}

/** Alguma palavra (4+ letras) de um lado casa com alguma do outro; barreira barata contra o id errado vindo do índice. */
export const palavrasEmComum = (a: string, b: string) => comPalavrasDe(b)(a);

function pontuacaoDoTexto(texto: string, termos: TermoPontuado[]) {
  if (!termos.length) return 0;
  const palavras = normalizarTexto(texto).match(/[\p{L}\p{N}]+/gu) ?? [];
  return termos.reduce((soma, t) => (palavras.some((p) => casa(p, t.termo)) ? soma + t.pontuacao : soma), 0);
}

export const dependeDeRevisaoAnterior = (conceito: ConceitoWiki, origem: FonteWiki) =>
  !conceito.protegida && !conceito.pausada && conceito.origens[origem.id] !== undefined && conceito.origens[origem.id] !== origem.revisao;

const porId = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Mesmo formato e verificação de fontes para recuperação normal e leitura dirigida. */
export async function carregarCandidata(repo: RepositorioDeNotas, id: string, conceitos: ConceitoWiki[]): Promise<CandidataWiki | null> {
  const nota = await repo.obterNota(id); if (!nota) return null;
  const metadados = await repo.wiki!.obter(id) ?? undefined;
  let obsoletas: string[] | undefined;
  if (metadados) {
    const validas = new Set<string>();
    for (const fonte of metadados.fontes) {
      const atual = await repo.obterNota(fonte.id);
      if (atual && fonteConfere(atual.conteudo, fonte)) validas.add(fonte.id);
    }
    metadados.afirmacoes = garantirIds(metadados.afirmacoes);
    obsoletas = metadados.afirmacoes.filter((a) => !a.evidencias.every((e) => validas.has(e.fonteId))).map((a) => a.id);
  }
  const ligadoPor = metadados ? conceitos.filter((c) => c.notaId !== id && c.ligacoes?.includes(id)).map((c) => c.notaId) : undefined;
  return { nota, metadados, conceito: conceitos.find((c) => c.notaId === id), obsoletas, ...(ligadoPor ? { ligadoPor } : {}) };
}

/** Vizinhos de cada neurônio nos dois sentidos: a quem ele se liga e quem se liga a ele. */
export function vizinhosDosNeuronios(conceitos: ConceitoWiki[]) {
  const vizinhos = new Map<string, Set<string>>();
  const ligar = (a: string, b: string) => { if (a !== b) vizinhos.set(a, (vizinhos.get(a) ?? new Set()).add(b)); };
  for (const c of conceitos) for (const outro of c.ligacoes ?? []) { ligar(c.notaId, outro); ligar(outro, c.notaId); }
  return vizinhos;
}

/**
 * Todas as sínteses por título, apelidos e resumo, as mais próximas da nota primeiro, dentro de um teto de entradas e de
 * tamanho. É o que permite ao modelo reconhecer um conceito que a recuperação não trouxe e ligá-lo.
 */
export function construirIndice(conceitos: ConceitoWiki[], resumos: Map<string, Pick<ResumoDeNota, "titulo">>, termos: TermoPontuado[]): IndiceWiki {
  const todas = conceitos.flatMap((c) => {
    const nota = resumos.get(c.notaId);
    return nota ? [{ c, titulo: nota.titulo, pontos: pontuacaoDoTexto(`${nota.titulo} ${c.aliases.join(" ")} ${c.resumo ?? ""}`, termos) }] : [];
  // Empate: as mais recentes primeiro, que são as que a nota ainda não viu e as mais prováveis de ser duplicadas.
  }).sort((a, b) => b.pontos - a.pontos || porId(b.c.notaId, a.c.notaId));
  const entradas: IndiceWiki["entradas"] = []; let tamanho = 0;
  for (const { c, titulo } of todas) {
    const entrada = { id: c.notaId, titulo, aliases: c.aliases.slice(0, ALIASES_NO_INDICE), protegida: c.protegida || Boolean(c.pausada),
      resumo: c.resumo?.slice(0, RESUMO_NO_INDICE) ?? null };
    const custo = JSON.stringify(entrada).length + 1;
    if (entradas.length >= ENTRADAS_NO_INDICE || tamanho + custo > TAMANHO_DO_INDICE) break;
    entradas.push(entrada); tamanho += custo;
  }
  return { total: todas.length, entradas };
}

/**
 * Candidatas e índice para uma origem. Cada termo da nota é buscado uma vez no acervo: o resultado diz o quanto o
 * termo é raro e quais notas o contêm. Notas e sínteses (também pelo título e apelidos) competem na mesma pontuação.
 */
export async function recuperarContexto(repo: RepositorioDeNotas, origem: FonteWiki, trecho: string, conceitos: ConceitoWiki[]):
  Promise<{ candidatas: CandidataWiki[]; indice: IndiceWiki; dependentes: string[] }> {
  const resumos = await repo.listarResumos();
  const preliminares = ordenarTermos(origem.titulo, trecho);
  const frequencias = new Map<string, number>(); const acertos = new Map<string, string[]>();
  let uteis = 0;
  for (const [i, { termo }] of preliminares.entries()) {
    // Os mais salientes primeiro; só passa de dez quando eles eram exclusivos da nota e quase nada foi achado.
    if (i >= TERMOS_PRELIMINARES && uteis >= TERMOS_UTEIS_MINIMOS) break;
    const ids = (await repo.buscarIdsPorConteudo(termo, LIMITE_DA_CONSULTA_DE_TERMO + 1)).filter((id) => id !== origem.id);
    frequencias.set(termo, ids.length); acertos.set(termo, ids);
    if (ids.length) uteis++;
  }
  const termos = pontuarTermos(preliminares, frequencias, resumos.length);
  const pontuacao = new Map<string, number>();
  const somar = (id: string, pontos: number) => pontuacao.set(id, (pontuacao.get(id) ?? 0) + pontos);
  for (const t of termos) for (const id of acertos.get(t.termo) ?? []) somar(id, t.pontuacao);
  for (const c of conceitos) {
    const pontos = pontuacaoDoTexto(`${c.chave} ${c.aliases.join(" ")} ${c.resumo ?? ""}`, termos);
    if (pontos > 0) somar(c.notaId, pontos);
  }
  // Um salto na rede: o vizinho de um neurônio pontuado herda parte da pontuação dele (sobre a pontuação direta, sem cascata).
  const vizinhos = vizinhosDosNeuronios(conceitos);
  for (const [id, pontos] of [...pontuacao]) for (const vizinho of vizinhos.get(id) ?? []) somar(vizinho, pontos * PESO_DO_VIZINHO);
  const ids = new Set<string>();
  // Ondas pequenas de dependentes (`DEPENDENTES_POR_ONDA`): só estas têm garantia de ser atualizáveis nesta chamada.
  // As demais, mesmo quando a pontuação as traz como candidatas, ficam para a próxima onda.
  const dependentes = conceitos.filter((v) => dependeDeRevisaoAnterior(v, origem)).slice(0, DEPENDENTES_POR_ONDA).map((c) => c.notaId);
  for (const id of dependentes) ids.add(id);
  for (const [id] of [...pontuacao].sort((a, b) => b[1] - a[1] || porId(a[0], b[0]))) {
    if (ids.size >= CANDIDATAS_POR_RODADA) break;
    if (id !== origem.id) ids.add(id);
  }
  const candidatas: CandidataWiki[] = [];
  for (const id of ids) {
    if (id === origem.id) continue;
    const candidata = await carregarCandidata(repo, id, conceitos);
    if (candidata) candidatas.push(candidata);
  }
  return { candidatas, dependentes, indice: construirIndice(conceitos, new Map(resumos.map((r) => [r.id, r])), termos) };
}
