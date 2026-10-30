import { z } from "zod";
import { normalizarTexto, validarTitulo, caminhoParaLigacao } from "../caminho-da-nota";
import { descreverErro } from "../registro-de-erros";
import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";
import { ErroDaGeracaoWiki, ErroWiki, LIMITE_DE_LIGACOES, type AfirmacaoWiki, type DivergenciaWiki, type FonteWiki, type MetadadosWiki, type PublicacaoWiki } from "./tipos";
import type { ConceitoWiki, ConsumoWiki, ContextoWiki, GeradorAutomaticoWiki, MotivoDaFalhaWiki } from "./automacao-tipos";
import { afirmacoesVisiveis, comId, garantirIds, LIMITE_DE_AFIRMACOES, LIMITE_DE_AFIRMACOES_VISIVEIS } from "./afirmacoes";
import { citacaoInsuficiente, localizarCitacao } from "./citacoes";
import { CANDIDATAS_POR_RODADA, comPalavrasDe, dependeDeRevisaoAnterior, palavrasEmComum, recuperarContexto, carregarCandidata } from "./recuperacao";
import { verificarSinteses } from "./observabilidade";
import { estruturaCompativel } from "./estrutura";
import { identidadeDoTema } from "./identidade";
import { camposDoEnvelopeEditorial, DecisaoEditorialAdiada, esquemaDoEnvelopeEditorial, esquemaEditorial, POLITICA_EDITORIAL, PROPOSTAS_POR_RESPOSTA, PropostaEditorialRecusada } from "./editorial";

const esquemaDaAfirmacao = z.object({ texto: z.string().trim().min(1).max(2000),
  natureza: z.enum(["explicita", "inferencia"]),
  evidencias: z.array(z.object({ fonteId: z.string(), citacao: z.string().min(1).max(2000) }).strict()).min(1).max(10),
}).strict();
const ladoDaDivergencia = z.object({ afirmacaoId: z.string().min(1).max(100), contexto: z.string().trim().min(1).max(500) }).strict();
const esquemaDaProposta = z.object({
  titulo: z.string().trim().min(1).max(200), alvoId: z.string().nullable(),
  aliases: z.array(z.string().trim().min(1).max(100)).max(12),
  /** Acrescenta. As afirmações da síntese que nenhuma operação cita são mantidas (se a evidência ainda existir). */
  afirmacoes: z.array(esquemaDaAfirmacao).max(24),
  /** Troca o conteúdo de uma afirmação existente, pelo id que o modelo viu. */
  substituicoes: z.array(z.object({ id: z.string(), afirmacao: esquemaDaAfirmacao }).strict()).max(24).default([]),
  /** Retira afirmações existentes, pelo id que o modelo viu. */
  retiradas: z.array(z.string()).max(24).default([]),
  /** Outra evidência da mesma proposição: mantém identidade lógica, texto e natureza. */
  reforcos: z.array(z.object({ id: z.string(), evidencias: esquemaDaAfirmacao.shape.evidencias }).strict()).max(24).default([]),
  /**
   * Ids de outras sínteses a que esta se liga (o que o modelo viu no índice ou nas candidatas) ou `proposta:N`, outra
   * proposta desta mesma resposta (a partir de 1). Não são evidência.
   */
  // Sem teto aqui: o servidor guarda no máximo `LIMITE_DE_LIGACOES`, e um excesso não pode custar a proposta inteira.
  ligacoes: z.array(z.string()).default([]),
  /** Uma frase sobre o que o neurônio trata, para o índice; null mantém a atual. */
  resumo: z.string().trim().max(240).nullable().default(null),
  ligacoesRetiradas: z.array(z.string()).max(32).default([]),
  /** Cada lado aponta para um id visível ou `nova:N` (posição na lista de acréscimos, a partir de 1). */
  divergencias: z.array(z.object({ a: ladoDaDivergencia, b: ladoDaDivergencia }).strict()).max(10).default([]),
  /** A lista completa de perguntas em aberto; vazia (ou só de espaços) numa síntese que já existe mantém as que ela tinha. */
  lacunas: z.array(z.string().max(1000)).max(10),
  limparLacunas: z.boolean().default(false),
}).strict();
/** O que se lê das ligações pedidas, para que uma lista enorme não vire uma enxurrada de consultas. */
const LIMITE_DE_PEDIDAS = 32;
const IRMA = /^proposta:[1-9]\d?$/;
export const esquemaDaDescoberta = z.object({ propostas: z.array(esquemaDaProposta).max(PROPOSTAS_POR_RESPOSTA) }).strict();
const esquemaDaPropostaEditorial = esquemaDaProposta.extend({ editorial: esquemaEditorial });
export const esquemaDaDescobertaEditorial = z.object({ ...camposDoEnvelopeEditorial, propostas: z.array(esquemaDaPropostaEditorial).max(PROPOSTAS_POR_RESPOSTA) }).strict();
/** O servidor valida o envelope e depois cada proposta: uma malformada não derruba as outras. */
const esquemaDoEnvelope = z.object({ propostas: z.array(z.unknown()).max(PROPOSTAS_POR_RESPOSTA) }).strict();
type PropostaWiki = z.infer<typeof esquemaDaProposta> & { editorial?: z.infer<typeof esquemaEditorial> };

const SEM_COBRANCA: ConsumoWiki = { entrada: 0, saida: 0 };
/** Teto de saída de uma descoberta (raciocínio incluído): seis propostas editoriais não cabem nos 4096 do chat. A reserva usa o mesmo valor. */
export const SAIDA_MAXIMA_DA_WIKI = 12_288;

/** Payload limitado: os snapshots completos ficam no servidor, fora do contexto do modelo. */
export function entradaDaDescoberta(c: ContextoWiki) {
  const relacionada = comPalavrasDe(c.trecho.texto);
  const lidos = c.candidatas.filter((p) => p.metadados).map((p) => p.nota.id);
  return { origem: { tipo: "nota_pessoal" as const, id: c.origem.id, titulo: c.origem.titulo, revisao: c.origem.revisao,
    totalDeCaracteres: c.origem.conteudo.length, leituraParcial: c.trecho.inicio > 0 || c.trecho.fim < c.origem.conteudo.length, ...c.trecho },
    papeis: { fontesPessoaisLidas: [c.origem.id, ...c.candidatas.filter((p) => !p.metadados).map((p) => p.nota.id)],
      neuroniosLidos: lidos, neuroniosSomenteNoIndice: c.indice.entradas.filter((p) => !lidos.includes(p.id)).map((p) => p.id) },
    // Todas as sínteses por título e apelidos (as mais próximas da nota primeiro): reconhecer um conceito que a busca não trouxe.
    indice: c.indice,
    candidatas: c.candidatas.map((p) => ({ id: p.nota.id, titulo: p.nota.titulo, revisao: p.nota.revisao,
      tipo: p.metadados ? "neuronio" : "nota_pessoal", podeSerFonte: !p.metadados,
      conteudoIgualAOrigem: !p.metadados && p.nota.conteudo === c.origem.conteudo,
      leituraParcial: p.nota.conteudo.length > 4000 || (p.metadados?.afirmacoes.length ?? 0) > LIMITE_DE_AFIRMACOES_VISIVEIS,
      podeReceberEdicao: Boolean(p.metadados) && !p.conceito?.protegida && !p.conceito?.pausada && !p.metadados?.gerencia?.protegida,
      gerenciada: Boolean(p.metadados), protegida: Boolean(p.conceito?.protegida || p.conceito?.pausada), pausada: p.conceito?.pausada ?? false,
      // Síntese construída sobre uma revisão anterior desta origem: o modelo deve atualizá-la ou deixá-la como está.
      desatualizadaPelaOrigem: p.conceito ? dependeDeRevisaoAnterior(p.conceito, c.origem) : false,
      aliases: p.conceito?.aliases ?? [], texto: p.nota.conteudo.slice(0, 4000),
      // Com id: é por ele que o modelo mantém, substitui ou retira. As desatualizadas (a origem mudou) e as da origem vêm
      // primeiro; `totalDeAfirmacoes` diz o que ficou de fora.
      afirmacoes: p.metadados && afirmacoesVisiveis(garantirIds(p.metadados.afirmacoes), { origemId: c.origem.id, obsoletas: new Set(p.obsoletas), relacionada })
        .map((a) => (p.obsoletas?.includes(a.id) ? { ...a, desatualizada: true } : a)),
      totalDeAfirmacoes: p.metadados?.afirmacoes.length,
      // O que a síntese já liga, quem a cita e as perguntas que ela ainda tem em aberto: o modelo devolve a lista completa das perguntas.
      resumo: p.metadados?.estrutura?.resumo ?? null,
      ligacoes: p.metadados?.estrutura?.ligacoes,
      ligadoPor: p.metadados ? p.ligadoPor ?? [] : undefined,
      lacunas: p.metadados?.estrutura?.lacunas,
      divergencias: p.metadados?.estrutura?.divergencias ?? [],
    })),
    limiteDeAfirmacoes: LIMITE_DE_AFIRMACOES,
  };
}

function trechoDaOrigem(conteudo: string, inicio: number) {
  let fim = Math.min(inicio + 8000, conteudo.length);
  if (fim < conteudo.length) {
    const quebra = conteudo.lastIndexOf("\n", fim);
    if (quebra > inicio + 4000) fim = quebra + 1;
    if (/[\uD800-\uDBFF]/.test(conteudo[fim - 1])) fim--;
  }
  return { inicio, fim, texto: conteudo.slice(inicio, fim) };
}

/** Apenas IDs de neurônios vistos só no índice podem originar leitura dirigida. */
function decisaoDaDescoberta(bruto: unknown, c: ContextoWiki) {
  if (!bruto || typeof bruto !== "object" || !("politica" in bruto)) return null;
  const envelope = esquemaDoEnvelopeEditorial.parse(bruto);
  const d = envelope.semPublicacao;
  if (d?.tipoDePendencia === "leitura_de_neuronio") {
    const permitidos = new Set(c.indice.entradas.filter((v) => !v.protegida && !c.candidatas.some((p) => p.nota.id === v.id && p.metadados)).map((v) => v.id));
    if (d.neuroniosALer.some((id) => !permitidos.has(id))) throw new PropostaEditorialRecusada();
  }
  return envelope;
}

/** Entradas do índice que só saem depois das candidatas: abaixo disso o modelo perderia o mapa dos conceitos próximos. */
const PISO_DO_INDICE = 60;

/**
 * Reduz primeiro o contexto menos prioritário: o fim do índice (as entradas menos próximas) até o piso, depois as
 * candidatas e por último o resto do índice. Mantém origem, dependentes e leituras solicitadas.
 */
function limitarContexto(c: ContextoWiki, maximo: number, solicitadas: Set<string>) {
  const fixas = new Set([...c.dependentes, ...solicitadas]);
  while (Buffer.byteLength(JSON.stringify(entradaDaDescoberta(c)), "utf8") > Math.max(0, maximo)) {
    const indice = c.indice.entradas.findLastIndex((v) => !solicitadas.has(v.id));
    if (indice >= PISO_DO_INDICE) { c.indice.entradas.splice(indice, 1); continue; }
    const candidata = c.candidatas.findLastIndex((v) => !fixas.has(v.nota.id));
    if (candidata >= 0) { c.candidatas.splice(candidata, 1); continue; }
    if (indice >= 0) { c.indice.entradas.splice(indice, 1); continue; }
    break;
  }
}

async function lerDestinos(repo: RepositorioDeNotas, c: ContextoWiki, ids: string[]) {
  const conceitos = await repo.wiki!.automacao!.conceitos();
  const novas = [];
  for (const id of ids) {
    const p = await carregarCandidata(repo, id, conceitos);
    if (!p?.metadados || !p.conceito || p.conceito.protegida || p.conceito.pausada || p.metadados.gerencia?.protegida) throw new PropostaEditorialRecusada();
    novas.push(p);
  }
  const fixas = c.candidatas.filter((p) => c.dependentes.includes(p.nota.id));
  const unicas = new Map([...fixas, ...novas, ...c.candidatas].map((p) => [p.nota.id, p]));
  // As fixas precedem as novas, mas uma cópia antiga nunca substitui uma leitura recém-feita.
  for (const p of novas) unicas.set(p.nota.id, p);
  c.candidatas = [...unicas.values()].slice(0, CANDIDATAS_POR_RODADA);
  for (const p of novas) {
    const entrada = c.indice.entradas.find((e) => e.id === p.nota.id)!;
    entrada.titulo = p.nota.titulo;
  }
}

type Descarte = "estrutura" | "titulo" | "alvo" | "protegida" | "evidencia" | "divergencia" | "limite" | "repetida" | "titulo-em-uso" | "sem-mudanca" | "editorial";
/**
 * `tentadas`: sínteses que o modelo quis atualizar; se a proposta foi descartada, não contam como avaliadas.
 * Exceção: "sem-mudanca" é uma decisão (a síntese já diz isso), então a síntese conta como avaliada.
 */
type Preparo = { publicacoes: PublicacaoWiki[]; descartadas: Descarte[]; tentadas: Set<string>; revisar?: boolean;
  decisao?: import("./editorial").DecisaoSemPublicacao };

/** Ids que o modelo recebeu de cada síntese (`ids`) e quais delas estavam marcadas como desatualizadas (`obsoletas`). */
type Visiveis = Map<string, { ids: Set<string>; obsoletas: Set<string> }>;
/** Forma canônica das afirmações, estável mesmo depois de passar pelo jsonb (que reordena as chaves). */
const assinatura = (afirmacoes: AfirmacaoWiki[]) => JSON.stringify(afirmacoes.map((a) =>
  [a.id, a.natureza, a.evidencias.map((e) => [e.fonteId, e.inicio, e.fim, e.citacao])]));

const escapar = (s: string) => s.replace(/[\\`*_{}[\]<>()!#|]/g, "\\$&").replace(/[\r\n]+/g, " ");
// Os caracteres que quebrariam uma ligação ou o caminho viram hífen ou espaço, em vez de custar a proposta.
// Caracteres invisíveis e de direção de texto também saem: "Fatorial" e "Fatorial​" pareceriam o mesmo título.
const limparTitulo = (titulo: string) => titulo.normalize("NFKC").replace(/[​-‏‪-‮⁠-⁯﻿]/g, "")
  .replace(/[/\\]/g, "-").replace(/[[\]#^|\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const caminhoOcupado = (pasta: string | null, titulo: string) => `${(pasta ?? "").toLowerCase()}\n${titulo.toLowerCase()}`;

/** O título proposto ou, se a pasta já tiver uma nota assim (a própria origem, por exemplo), uma variante de síntese. */
function tituloLivre(titulo: string, pasta: string | null, ocupados: Set<string>) {
  // Uma nota homônima dentro de uma pasta (tão funda quanto "Neurônios" ou mais) perderia para o neurônio num [[Título]] solto,
  // que passaria a apontar para ele. Na raiz a nota já vence a desambiguação, então ali o título segue livre.
  const emUso = (opcao: string) => ocupados.has(caminhoOcupado(pasta, opcao))
    || [...ocupados].some((c) => c.endsWith(`\n${opcao.toLowerCase()}`) && !c.startsWith("\n"));
  return [titulo, `${titulo} (síntese)`].find((opcao) => validarTitulo(opcao).ok && !emUso(opcao)) ?? null;
}

/**
 * As sínteses a que esta se liga: as que já tinha, que ainda existem, e as novas que o modelo pediu e viu (índice ou
 * candidatas). Sem repetição, sem ela mesma, no máximo `LIMITE_DE_LIGACOES`. Id que não é de uma síntese (nota pessoal, inexistente) sai
 * sozinho: ligar é uma sugestão, e uma sugestão ruim não derruba a proposta.
 */
async function ligacoesDaSintese(repo: RepositorioDeNotas, c: ContextoWiki, pedidas: string[], existentes: string[], propria: string | null, retiradas: string[]) {
  const vistas = new Set([...c.indice.entradas.map((e) => e.id), ...c.candidatas.filter((v) => v.metadados).map((v) => v.nota.id)]);
  const conhecidas = new Set(c.candidatas.find((v) => v.nota.id === propria)?.metadados?.estrutura.ligacoes ?? []);
  const remover = new Set(retiradas.filter((id) => conhecidas.has(id)));
  const notas: { id: string; pasta: string | null; titulo: string }[] = [];
  // Filtrar pelo que o modelo viu antes de limitar: ids inventados não podem empurrar para fora os válidos.
  for (const id of [...existentes, ...pedidas.filter((p) => vistas.has(p)).slice(0, LIMITE_DE_PEDIDAS)]) {
    if (id === propria || remover.has(id) || notas.some((n) => n.id === id) || notas.length >= LIMITE_DE_LIGACOES) continue;
    const nota = await repo.obterNota(id);
    if (nota && await repo.wiki!.obter(id)) notas.push({ id, pasta: nota.pasta, titulo: nota.titulo });
  }
  return notas;
}

/** Chave, aliases e título atual; a apresentação com “(síntese)” não muda a identidade. */
function identidadesConhecidas(conceitos: ConceitoWiki[], chave: string, titulos: Map<string, string>) {
  const tema = identidadeDoTema(chave);
  return conceitos.filter((c) => [c.chave, ...c.aliases, titulos.get(c.notaId) ?? ""].some((v) => identidadeDoTema(v) === tema));
}

/**
 * O que o modelo efetivamente recebeu de cada fonte: uma citação fora disso não pode ter sido lida.
 * `janelas` é texto corrido (o trecho da origem, o início de uma nota pessoal candidata), onde a posição da citação vale;
 * `citadas` é a soma das citações guardadas nas afirmações das candidatas, que não têm posição nenhuma neste texto.
 */
type Leituras = { janelas: Map<string, string>; citadas: Map<string, string> };
function textosDasEntradas(c: ContextoWiki): Leituras {
  const janelas = new Map<string, string>([[c.origem.id, c.trecho.texto]]);
  const citadas = new Map<string, string>();
  for (const candidata of entradaDaDescoberta(c).candidatas) {
    if (!candidata.gerenciada) janelas.set(candidata.id, candidata.texto);
    for (const a of candidata.afirmacoes ?? []) for (const e of a.evidencias) {
      citadas.set(e.fonteId, `${citadas.get(e.fonteId) ?? ""}\n${e.citacao}`);
    }
  }
  return { janelas, citadas };
}

/** Raízes pessoais que a proposta pode citar: a origem, as raízes do alvo e das candidatas e as candidatas pessoais. */
async function fontesPermitidas(repo: RepositorioDeNotas, c: ContextoWiki, meta: MetadadosWiki | null) {
  const fontes = new Map<string, FonteWiki>([[c.origem.id, c.origem]]);
  for (const fonte of [...meta?.fontes ?? [], ...c.candidatas.flatMap((v) => v.metadados?.fontes ?? [])]) {
    const atual = await repo.obterNota(fonte.id);
    if (atual && !await repo.wiki!.obter(fonte.id)) fontes.set(atual.id, atual);
  }
  for (const candidata of c.candidatas) if (!candidata.metadados) fontes.set(candidata.nota.id, candidata.nota);
  return fontes;
}

function localizarEvidencia(e: { fonteId: string; citacao: string }, fontes: Map<string, FonteWiki>, leituras: Leituras, c: ContextoWiki) {
  const fonte = fontes.get(e.fonteId);
  const janela = leituras.janelas.get(e.fonteId); const citadas = leituras.citadas.get(e.fonteId);
  if (!fonte || (!janela && !citadas) || citacaoInsuficiente(e.citacao, janela ?? citadas ?? "")) return null;
  let posicao: { inicio: number; fim: number } | null = null;
  const naJanela = janela ? localizarCitacao(janela, e.citacao) : null;
  if (janela && naJanela) {
    // A posição vale onde o modelo leu: o trecho da origem, ou o prefixo da candidata. Só sem janela contígua busca na nota toda.
    posicao = e.fonteId === c.origem.id ? { inicio: naJanela.inicio + c.trecho.inicio, fim: naJanela.fim + c.trecho.inicio }
      : fonte.conteudo.startsWith(janela) ? naJanela : localizarCitacao(fonte.conteudo, e.citacao);
  } else if (citadas && localizarCitacao(citadas, e.citacao)) {
    // Reapresentar uma citação guardada numa síntese: só vale se o trecho ainda está no texto atual da nota.
    posicao = localizarCitacao(fonte.conteudo, e.citacao);
  }
  const trecho = posicao && fonte.conteudo.slice(posicao.inicio, posicao.fim);
  // Guarda o trecho original, não a cópia do modelo; trecho vazio ou fora do texto nunca é evidência.
  return posicao && trecho ? { fonteId: e.fonteId, citacao: trecho, ...posicao } : null;
}

async function prepararProposta(repo: RepositorioDeNotas, c: ContextoWiki, p: PropostaWiki,
  conceitos: ConceitoWiki[], textos: Leituras, ocupados: Set<string>, visiveis: Visiveis, titulos: Map<string, string>): Promise<Preparada | Descarte> {
  const titulo = validarTitulo(limparTitulo(p.titulo));
  if (!titulo.ok) return "titulo";
  const chave = normalizarTexto(titulo.titulo);
  // O modelo só aponta para uma síntese que viu: entre as candidatas ou no índice.
  if (p.alvoId && !c.candidatas.some((v) => v.nota.id === p.alvoId)) {
    const doIndice = c.indice.entradas.find((e) => e.id === p.alvoId);
    // Do índice ele só leu título e apelidos: se a proposta não fala do mesmo assunto, o id provavelmente está errado,
    // e anexar afirmações a outra síntese a contaminaria.
    if (!doIndice || !palavrasEmComum(`${p.titulo} ${p.aliases.join(" ")}`, `${doIndice.titulo} ${doIndice.aliases.join(" ")}`)) return "alvo";
  }
  const conhecidas = identidadesConhecidas(conceitos, chave, titulos);
  // Nem escolher arbitrariamente entre duplicatas legadas, nem abrir uma terceira página.
  if (!p.alvoId && conhecidas.length > 1) return "alvo";
  const alvoId = p.alvoId ?? conhecidas[0]?.notaId;
  const alvo = alvoId ? await repo.obterNota(alvoId) : null;
  const meta = alvoId ? await repo.wiki!.obter(alvoId) : null;
  if (meta && alvo) meta.estrutura = estruturaCompativel(meta.estrutura, alvo.conteudo);
  const conceito = conceitos.find((v) => v.notaId === alvoId);
  if (alvoId && (!alvo || !meta)) return "alvo";
  if (conceito?.protegida || conceito?.pausada) return "protegida";
  if (p.limparLacunas && p.lacunas.some((v) => v.trim())) return "estrutura";
  if (p.editorial) {
    const e = p.editorial;
    const vistas = new Set([...c.indice.entradas.map((v) => v.id), ...c.candidatas.filter((v) => v.metadados).map((v) => v.nota.id)]);
    if ([e.utilidade, e.ganho, e.destino].some((v) => v.avaliacao !== "suficiente") || e.candidatas.some((id) => !vistas.has(id))) return "editorial";
    // Alterar exige ler o conteúdo do alvo; um título no índice não autoriza enriquecer às cegas.
    if (e.acao === "criar" ? Boolean(alvoId) : (!alvoId || !c.candidatas.some((v) => v.nota.id === alvoId && v.metadados) || !e.candidatas.includes(alvoId))) return "editorial";
    if (e.acao === "relacionar" && (p.afirmacoes.length || p.substituicoes.length || p.retiradas.length || p.reforcos.length)) return "editorial";
    if (!alvoId && (p.reforcos.length || p.substituicoes.length || p.retiradas.length)) return "editorial";
  }
  // As perguntas em aberto são a lista completa: vazia (ou só de espaços), numa síntese que já existe, mantém as que ela tinha.
  const pedidasEmAberto = p.lacunas.map((l) => l.trim()).filter(Boolean);
  const lacunas = p.limparLacunas ? [] : pedidasEmAberto.length ? pedidasEmAberto : meta?.estrutura?.lacunas ?? [];
  const ligadas = await ligacoesDaSintese(repo, c, p.ligacoes, meta?.estrutura?.ligacoes ?? [], alvoId ?? null, p.ligacoesRetiradas);
  // Posições (na resposta, a partir de 0) das propostas irmãs; só viram ligação se a irmã também for publicada.
  const irmas = [...new Set(p.ligacoes.filter((id) => IRMA.test(id)).map((id) => Number(id.slice(9)) - 1))];
  const resumo = p.resumo?.trim() || meta?.estrutura?.resumo || null;
  // Ligar a outra síntese, mudar as perguntas ou o resumo é uma mudança por si só, mesmo sem afirmação nova: sem isso uma
  // síntese antiga nunca ganharia a ligação a uma criada depois.
  const mudaEstrutura = Boolean(alvoId) && (JSON.stringify(lacunas) !== JSON.stringify(meta?.estrutura?.lacunas ?? [])
    || JSON.stringify(ligadas.map((n) => n.id)) !== JSON.stringify(meta?.estrutura?.ligacoes ?? [])
    || irmas.length > 0 || resumo !== (meta?.estrutura?.resumo ?? null));
  // Uma síntese que já existe e nenhuma operação pedida: o modelo a viu e decidiu não mudar nada. Isso é uma decisão,
  // não uma falha, e a síntese conta como avaliada em vez de travar a nota em chamadas repetidas.
  if (alvoId && !p.afirmacoes.length && !p.substituicoes.length && !p.retiradas.length && !p.reforcos.length && !p.divergencias.length && !mudaEstrutura) return "sem-mudanca";
  const fontes = await fontesPermitidas(repo, c, meta);
  const validar = (a: z.infer<typeof esquemaDaAfirmacao>): AfirmacaoWiki | null => {
    const evidencias = a.evidencias.map((e) => localizarEvidencia(e, fontes, textos, c));
    // Uma evidência sem suporte derruba a afirmação, não a proposta inteira.
    if (evidencias.some((e) => e === null)) return null;
    return comId({ ...a, evidencias: evidencias.filter((e): e is NonNullable<typeof e> => e !== null) });
  };
  const novasPorPosicao = p.afirmacoes.map(validar);
  if (p.editorial && novasPorPosicao.some((a) => a === null)) return "evidencia";
  const novas = novasPorPosicao.filter((a): a is AfirmacaoWiki => a !== null);
  // Manter, substituir ou retirar só vale numa síntese que já existe e só para o que o modelo viu (os ids que mostramos).
  const mostradas = visiveis.get(alvoId ?? "");
  const anteriores = garantirIds(meta?.afirmacoes ?? []);
  if (p.editorial && [...p.substituicoes.map((s) => s.id), ...p.retiradas].some((id) => !mostradas?.ids.has(id))) return "evidencia";
  // Igualdade textual é só uma barreira objetiva; paráfrases continuam exigindo avaliação semântica.
  if (p.editorial && novas.some((a) => anteriores.some((v) => normalizarTexto(v.texto) === normalizarTexto(a.texto)))) return "editorial";
  const reforcos = new Map<string, AfirmacaoWiki["evidencias"]>();
  for (const r of p.reforcos) {
    if (!mostradas?.ids.has(r.id) || p.substituicoes.some((s) => s.id === r.id) || p.retiradas.includes(r.id)) return "evidencia";
    const evidencias = r.evidencias.map((e) => localizarEvidencia(e, fontes, textos, c));
    if (evidencias.some((e) => !e)) return "evidencia";
    reforcos.set(r.id, [...reforcos.get(r.id) ?? [], ...evidencias.filter((e): e is NonNullable<typeof e> => e !== null)]);
  }
  const idsAnteriores = new Set(anteriores.map((a) => a.id));
  // Remover ou trocar o que continua sustentado tem teto por proposta; o que já estava obsoleto (a origem mudou) não conta.
  // Sem isso, um modelo errado ou uma nota com instruções desfaria a síntese em poucas ondas.
  let orcamentoDeRemocoes = Math.max(3, Math.ceil(anteriores.length / 4));
  // Só a nota que sustenta a afirmação pode tirá-la ou trocá-la: outra nota (ou uma instrução dentro dela) que discorda
  // registra a divergência, não apaga o que B e C afirmam. O que já está obsoleto (a origem mudou) segue livre.
  const soDaOrigem = (id: string) => anteriores.find((a) => a.id === id)?.evidencias.every((e) => e.fonteId === c.origem.id) ?? false;
  const podeMexer = (id: string) => mostradas?.obsoletas.has(id) || (soDaOrigem(id) && orcamentoDeRemocoes-- > 0);
  const substituicoes = new Map<string, AfirmacaoWiki>();
  for (const s of alvoId ? p.substituicoes : []) {
    if (!mostradas?.ids.has(s.id) || substituicoes.has(s.id)) continue;
    const nova = validar(s.afirmacao);
    // Substituição com evidência sem suporte não vale: a afirmação antiga continua no lugar. Também não vale trocar por
    // algo que a síntese já tem (ou que outra troca já produziu): isso só apagaria a antiga, e em ondas esvaziaria tudo.
    if (!nova || (nova.id !== s.id && (idsAnteriores.has(nova.id) || [...substituicoes.values()].some((v) => v.id === nova.id)))) {
      if (p.editorial) return "evidencia";
      continue;
    }
    if (podeMexer(s.id)) substituicoes.set(s.id, nova);
  }
  // Retirar sem que a nota traga algo no lugar só vale para o que já estava obsoleto. Retirar o que continua sustentado
  // pede uma afirmação nova ou substituta na mesma proposta: sem evidência nada se apaga.
  const justificada = novas.length > 0 || substituicoes.size > 0;
  const retiradas = new Set<string>();
  for (const id of alvoId ? p.retiradas : []) {
    if (!mostradas?.ids.has(id) || substituicoes.has(id)) continue;
    if ((justificada || mostradas.obsoletas.has(id)) && podeMexer(id)) retiradas.add(id);
  }
  if (!novas.length && !substituicoes.size && !retiradas.size && !reforcos.size && !mudaEstrutura && !p.divergencias.length) return "evidencia";
  // O que nenhuma operação cita é mantido, desde que a evidência ainda exista nas origens atuais.
  const preservadas: AfirmacaoWiki[] = [];
  for (const a of anteriores) {
    if (retiradas.has(a.id) || substituicoes.has(a.id)) continue;
    const evidencias = a.evidencias.flatMap((e) => {
      const fonte = fontes.get(e.fonteId);
      // O trecho guardado continua valendo onde está; só se foi deslocado a citação é procurada de novo. Uma citação repetida
      // no texto não pode saltar para a primeira ocorrência.
      if (fonte && fonte.conteudo.slice(e.inicio, e.fim) === e.citacao) return [e];
      // Mesma tolerância das novas: espaços e marcação diferentes não apagam uma afirmação ainda sustentada.
      const posicao = fonte && localizarCitacao(fonte.conteudo, e.citacao);
      return fonte && posicao ? [{ ...e, citacao: fonte.conteudo.slice(posicao.inicio, posicao.fim), ...posicao }] : [];
    });
    if (evidencias.length === a.evidencias.length) {
      const unicas = new Map(evidencias.map((e) => [`${e.fonteId}:${e.inicio}:${e.fim}`, e]));
      for (const e of reforcos.get(a.id) ?? []) unicas.set(`${e.fonteId}:${e.inicio}:${e.fim}`, e);
      if (unicas.size > 10) return "limite";
      preservadas.push({ ...a, evidencias: [...unicas.values()] });
    } else if (reforcos.has(a.id)) return "evidencia";
  }
  // Pelo id, e a primeira vence: reapresentar uma afirmação que já existe não a duplica nem muda sua natureza (inferência
  // não vira fato por ser repetida); só uma substituição troca o conteúdo.
  const porId = new Map<string, AfirmacaoWiki>();
  for (const a of [...preservadas, ...substituicoes.values(), ...novas]) if (!porId.has(a.id)) porId.set(a.id, a);
  const afirmacoes = [...porId.values()];
  if (!afirmacoes.length) return "evidencia";
  const divergencias: DivergenciaWiki[] = [];
  const pares = new Set<string>();
  const manter = (d: DivergenciaWiki) => {
    if (!porId.has(d.a.afirmacaoId) || !porId.has(d.b.afirmacaoId) || d.a.afirmacaoId === d.b.afirmacaoId) return;
    const chave = [d.a.afirmacaoId, d.b.afirmacaoId].sort().join(":");
    if (!pares.has(chave) && divergencias.length < 10) { pares.add(chave); divergencias.push(d); }
  };
  const resolver = (id: string) => /^nova:[1-9]\d?$/.test(id) ? novasPorPosicao[Number(id.slice(5)) - 1]?.id
    : mostradas?.ids.has(id) ? substituicoes.get(id)?.id ?? id : undefined;
  const pedidos: DivergenciaWiki[] = [];
  for (const d of p.divergencias) {
    const a = resolver(d.a.afirmacaoId); const b = resolver(d.b.afirmacaoId);
    // Uma divergência nova não pode desaparecer silenciosamente: ambos os lados precisam sobreviver à proposta.
    if (!a || !b || a === b || !porId.has(a) || !porId.has(b)) return "divergencia";
    pedidos.push({ a: { ...d.a, afirmacaoId: a }, b: { ...d.b, afirmacaoId: b } });
  }
  for (const d of meta?.estrutura.divergencias ?? []) {
    // Retirada explícita encerra o par. Trocar só a evidência mantém a relação com os IDs atualizados.
    if (retiradas.has(d.a.afirmacaoId) || retiradas.has(d.b.afirmacaoId)) continue;
    const a = substituicoes.get(d.a.afirmacaoId), b = substituicoes.get(d.b.afirmacaoId);
    const mudaProposicao = (id: string, nova?: AfirmacaoWiki) => nova && anteriores.some((v) => v.id === id && (v.texto !== nova.texto || v.natureza !== nova.natureza));
    const idA = a?.id ?? d.a.afirmacaoId, idB = b?.id ?? d.b.afirmacaoId;
    if (mudaProposicao(d.a.afirmacaoId, a) || mudaProposicao(d.b.afirmacaoId, b)) {
      // Não presumir que uma relação continua válida após mudar seu significado, nem apagá-la sem confirmação.
      if (!pedidos.some((v) => [v.a.afirmacaoId, v.b.afirmacaoId].sort().join(":") === [idA, idB].sort().join(":"))) return "divergencia";
      continue;
    }
    manter({ a: { ...d.a, afirmacaoId: idA }, b: { ...d.b, afirmacaoId: idB } });
  }
  for (const d of pedidos) {
    if (!pares.has([d.a.afirmacaoId, d.b.afirmacaoId].sort().join(":")) && divergencias.length >= 10) return "limite";
    manter(d);
  }
  const usadas = new Set(afirmacoes.flatMap((a) => a.evidencias.map((e) => e.fonteId)));
  const raizes = [...fontes.values()].filter((f) => usadas.has(f.id));
  if (raizes.length > 10 || afirmacoes.length > LIMITE_DE_AFIRMACOES) return "limite";
  const pasta = alvo ? alvo.pasta : "Neurônios";
  const nome = alvo?.titulo ?? tituloLivre(titulo.titulo, pasta, ocupados);
  if (!nome) return "titulo-em-uso";
  const conteudo = [`# ${nome}`, "Síntese do Bimo baseada nas anotações de origem. Inferências são interpretações.",
    ...afirmacoes.map((a) => `${a.natureza === "inferencia" ? "**Inferência:** " : ""}${escapar(a.texto)} ${a.evidencias.map((e) => `[${raizes.findIndex((f) => f.id === e.fonteId) + 1}]`).join(" ")}`),
    ...(lacunas.length ? ["## Questões em aberto", ...lacunas.map((v) => `- ${escapar(v)}`)] : []),
    ...(divergencias.length ? ["## Onde suas notas divergem", ...divergencias.map((d) =>
      `- ${escapar(porId.get(d.a.afirmacaoId)!.texto)} (${escapar(d.a.contexto)}) ↔ ${escapar(porId.get(d.b.afirmacaoId)!.texto)} (${escapar(d.b.contexto)})`)] : []),
    // Links de verdade: o grafo deriva as arestas do texto, sem espelhar nada em outra tabela.
    ...(ligadas.length ? ["## Neurônios relacionados", ...ligadas.map((n) => `- [[${caminhoParaLigacao(n.pasta, n.titulo)}]]`)] : []),
    "## Notas de origem", ...raizes.map((f, i) => `${i + 1}. [[${caminhoParaLigacao(f.pasta, f.titulo)}]] — revisão ${f.revisao}`),
  ].join("\n\n");
  const aliases = [...new Set([...(conceito?.aliases ?? []), ...p.aliases])].slice(0, 24);
  // O modelo concluiu que a síntese já diz isso: nada a publicar, e republicar só criaria uma revisão idêntica.
  // O markdown não mostra a evidência (só o número da origem): comparar também as afirmações, senão uma evidência nova
  // para o mesmo texto seria descartada como "sem mudança".
  const igual = Boolean(alvo) && conteudo === alvo!.conteudo && aliases.length === (conceito?.aliases.length ?? 0)
    && assinatura(afirmacoes) === assinatura(anteriores) && resumo === (meta?.estrutura?.resumo ?? null);
  if (igual && !irmas.length) return "sem-mudanca";
  return { titulo: nome, conteudo, fontes: raizes, afirmacoes, ligacoes: ligadas.map((n) => n.id), destinos: ligadas, lacunas, divergencias,
    // Só as irmãs justificam republicar: se nenhum link novo sair delas, `ligarIrmas` desiste da publicação.
    resumo, irmas, ...(igual ? { soIrmas: true } : {}),
    ...(p.editorial ? { editorial: { ...p.editorial, politica: POLITICA_EDITORIAL,
      origem: { id: c.origem.id, revisao: c.origem.revisao, inicio: c.trecho.inicio, fim: c.trecho.fim } } } : {}),
    alvo: alvo ? { id: alvo.id, revisao: alvo.revisao } : null, pasta,
    conceito: { chave: conceito?.chave ?? chave, aliases },
  };
}

/** Acrescenta itens à seção "Neurônios relacionados" (criando-a), que sempre antecede "Notas de origem". */
function comRelacionados(conteudo: string, caminhos: string[]) {
  const itens = caminhos.map((c) => `- [[${c}]]`).filter((item) => !conteudo.includes(item));
  if (!itens.length) return conteudo;
  const fim = conteudo.lastIndexOf("\n\n## Notas de origem");
  const antes = conteudo.slice(0, fim);
  const cabecalho = antes.includes("\n\n## Neurônios relacionados") ? "" : "\n\n## Neurônios relacionados";
  return `${antes}${cabecalho}\n\n${itens.join("\n\n")}${conteudo.slice(fim)}`;
}

/** `soIrmas`: uma síntese existente que só seria republicada pelas ligações `proposta:N`. */
type Preparada = PublicacaoWiki & { soIrmas?: boolean };

/**
 * Ligações entre propostas da mesma resposta (`proposta:N`): valem nos dois sentidos, só entre as que foram publicadas e
 * só com vaga nas duas pontas. O texto ganha o link pelo caminho agora; os ids entram em `ligacoes` quando a fila grava as
 * irmãs (`ligacoesComIrmas`). Uma síntese existente que só seria republicada por elas, sem nenhum link novo, sai da lista
 * (`semEfeito`); as irmãs passam a ligá-la direto pelo id.
 */
function ligarIrmas(publicacoes: Preparada[], publicadaEm: Map<number, number>) {
  const pares = publicacoes.map(() => new Set<number>());
  const vagas = publicacoes.map((p) => LIMITE_DE_LIGACOES - p.ligacoes.length);
  for (const [i, p] of publicacoes.entries()) for (const posicao of p.irmas ?? []) {
    const j = publicadaEm.get(posicao);
    if (j === undefined || j === i || pares[i].has(j) || vagas[i] <= 0 || vagas[j] <= 0) continue;
    pares[i].add(j); pares[j].add(i); vagas[i]--; vagas[j]--;
  }
  const ligadas = publicacoes.map((p, i) => {
    const irmas = [...pares[i]].sort((a, b) => a - b);
    return { ...p, irmas, conteudo: comRelacionados(p.conteudo, irmas.map((j) => caminhoParaLigacao(publicacoes[j].pasta, publicacoes[j].titulo))) };
  });
  const semEfeito = ligadas.map((p, i) => Boolean(publicacoes[i].soIrmas) && p.conteudo === publicacoes[i].conteudo);
  const novaPosicao = new Map<number, number>(); const ficam: typeof ligadas = [];
  for (const [i, p] of ligadas.entries()) if (!semEfeito[i]) { novaPosicao.set(i, ficam.length); ficam.push(p); }
  const publicadas = ficam.map((p): PublicacaoWiki => {
    const irmas: number[] = []; const ligacoes = [...p.ligacoes]; const destinos = [...p.destinos];
    for (const j of p.irmas) {
      const k = novaPosicao.get(j);
      if (k !== undefined) { irmas.push(k); continue; }
      // A irmã que saiu é uma síntese existente (só ela pode não ter efeito): o id já é conhecido.
      const fora = ligadas[j];
      if (fora.alvo && !ligacoes.includes(fora.alvo.id)) { ligacoes.push(fora.alvo.id); destinos.push({ id: fora.alvo.id, titulo: fora.titulo, pasta: fora.pasta }); }
    }
    return { ...p, irmas, ligacoes, destinos };
  });
  return { publicadas, semEfeito: ligadas.filter((_, i) => semEfeito[i]).map((p) => p.alvo!.id) };
}

/** Cada proposta é validada sozinha: uma citação ruim não joga fora o resultado pago das outras. */
async function prepararPublicacoes(repo: RepositorioDeNotas, c: ContextoWiki, bruto: unknown): Promise<Preparo> {
  // Apenas callbacks internos legados usam o contrato antigo. O gerador real exige a versão editorial.
  const editorial = Boolean(bruto && typeof bruto === "object" && "politica" in bruto);
  const decisao = editorial ? decisaoDaDescoberta(bruto, c) : null;
  const envelope = decisao ?? esquemaDoEnvelope.parse(bruto);
  if (decisao?.semPublicacao?.decisao === "adiar") throw new DecisaoEditorialAdiada(decisao.semPublicacao);
  const conceitos = await repo.wiki!.automacao!.conceitos();
  const resumos = await repo.listarResumos();
  const titulos = new Map(resumos.map((n) => [n.id, n.titulo]));
  const ocupados = new Set(resumos.map((n) => caminhoOcupado(n.pasta, n.titulo)));
  const textos = textosDasEntradas(c);
  // Os ids de afirmação que o modelo recebeu, por síntese: só com eles ele pode retirar ou substituir.
  const visiveis: Visiveis = new Map(entradaDaDescoberta(c).candidatas.flatMap((v) => v.afirmacoes ? [[v.id, {
    ids: new Set(v.afirmacoes.map((a) => a.id)),
    obsoletas: new Set(v.afirmacoes.filter((a) => "desatualizada" in a).map((a) => a.id)),
  }] as const] : []));
  const preparo: Preparo = { publicacoes: [], descartadas: [], tentadas: new Set(), ...(decisao?.semPublicacao ? { decisao: decisao.semPublicacao } : {}) };
  /** Posição da proposta na resposta → posição da publicação que ela gerou. */
  const publicadaEm = new Map<number, number>();
  for (const [posicao, bruta] of envelope.propostas.entries()) {
    const valida = (editorial ? esquemaDaPropostaEditorial : esquemaDaProposta).safeParse(bruta);
    if (!valida.success) { preparo.descartadas.push("estrutura"); continue; }
    const p = valida.data;
    const resultado = await prepararProposta(repo, c, p, conceitos, textos, ocupados, visiveis, titulos);
    const tentadas = p.alvoId ? [p.alvoId] : identidadesConhecidas(conceitos, limparTitulo(p.titulo), titulos).map((v) => v.notaId);
    if (resultado !== "sem-mudanca") for (const id of tentadas) preparo.tentadas.add(id);
    if (typeof resultado === "string") { preparo.descartadas.push(resultado); continue; }
    const identidade = resultado.alvo?.id ?? identidadeDoTema(resultado.conceito!.chave);
    if (preparo.publicacoes.some((q) => (q.alvo?.id ?? identidadeDoTema(q.conceito!.chave)) === identidade)) { preparo.descartadas.push("repetida"); continue; }
    if (!resultado.alvo) ocupados.add(caminhoOcupado(resultado.pasta ?? null, resultado.titulo));
    publicadaEm.set(posicao, preparo.publicacoes.length);
    preparo.publicacoes.push(resultado);
  }
  const { publicadas, semEfeito } = ligarIrmas(preparo.publicacoes, publicadaEm);
  preparo.publicacoes = publicadas;
  // Republicar só para repetir links que o texto já tem seria uma revisão idêntica: vale como decisão "sem mudança".
  for (const id of semEfeito) { preparo.descartadas.push("sem-mudanca"); preparo.tentadas.delete(id); }
  if (editorial && preparo.descartadas.some((v) => v !== "sem-mudanca")) {
    if (!preparo.publicacoes.length) {
      console.info("[wiki] Propostas descartadas na validação.", { quantidade: preparo.descartadas.length, motivos: [...new Set(preparo.descartadas)] });
      throw new PropostaEditorialRecusada();
    }
    // Aproveitar o que foi validado sem declarar concluída a parte recusada nem repeti-la automaticamente.
    preparo.revisar = true;
  }
  return preparo;
}

/**
 * Recusas 4xx do provedor não são cobradas; as que não dependem do momento dariam o mesmo resultado se repetidas.
 * `consumo` só importa quando a falha veio antes de confirmar a reserva.
 */
function classificarFalha(erro: unknown): { motivo: Exclude<MotivoDaFalhaWiki, "orcamento">; consumo: ConsumoWiki | null } {
  if (erro instanceof ErroWiki) return { motivo: erro.status === 409 ? "temporario" : "revisar", consumo: null };
  if (erro instanceof ErroDaGeracaoWiki) return { motivo: "revisar", consumo: erro.uso };
  if (erro instanceof z.ZodError) return { motivo: "revisar", consumo: null };
  const status = erro && typeof erro === "object" && "status" in erro && typeof erro.status === "number" ? erro.status : null;
  if (status === 401 || status === 403) return { motivo: "configuracao", consumo: SEM_COBRANCA };
  if (status !== null && status >= 400 && status < 500) {
    return { motivo: [408, 409, 429].includes(status) ? "temporario" : "revisar", consumo: SEM_COBRANCA };
  }
  // O provedor respondeu com erro de servidor: nada foi gerado nem cobrado. Contar a reserva inteira numa instabilidade
  // de minutos esgotaria o teto do dia sem gasto real. Falha de rede e prazo estourado seguem incertos (a chamada pode ter sido cobrada).
  if (status !== null && status >= 500) return { motivo: "temporario", consumo: SEM_COBRANCA };
  return { motivo: "temporario", consumo: null };
}

/** Um lote curto. A fila persistente é a fonte de verdade, não o tempo de vida da requisição. */
export async function processarWiki(repo: RepositorioDeNotas, gerar: GeradorAutomaticoWiki, opcoes: { tetoDiario: number; sinal?: AbortSignal; verificar?: boolean }) {
  const fila = repo.wiki?.automacao;
  if (!fila) return { tipo: "desligado" as const };
  // A verificação local é opcional e não chama o modelo: uma falha nela não pode parar a fila.
  if (opcoes.verificar !== false) {
    try { await verificarSinteses(repo); } catch (erro) { console.error("[wiki] A verificação das sínteses falhou.", { erro: descreverErro(erro) }); }
  }
  await fila.reconciliar(50);
  const trabalho = await fila.reivindicar();
  if (!trabalho) return { tipo: "ocioso" as const };
  let reserva: string | null = null; let contabilizada = false; let chamou = false;
  try {
    const origem = await repo.obterNota(trabalho.notaId);
    if (!origem || origem.revisao !== trabalho.revisao || await repo.wiki!.obter(origem.id)) throw new ErroWiki("Entrada superada.", 409);
    if (!origem.conteudo.trim()) { await fila.concluir(trabalho, [], null); return { tipo: "processado" as const, publicadas: 0, descartadas: 0 }; }
    const trecho = trechoDaOrigem(origem.conteudo, trabalho.cursor);
    const contexto: ContextoWiki = { origem, trecho, ...await recuperarContexto(repo, origem, trecho.texto, await fila.conceitos()) };
    const sinal = opcoes.sinal ? AbortSignal.any([opcoes.sinal, AbortSignal.timeout(40_000)]) : AbortSignal.timeout(40_000);
    let resultado: Awaited<ReturnType<GeradorAutomaticoWiki>> | undefined;
    const solicitadas = new Set<string>();
    for (let etapa = 0; etapa < 2; etapa++) {
      // O orçamento permanece igual. Quando há pouco saldo, reduzir contexto evita exigir a reserva máxima sem necessidade.
      const saldo = (await fila.energia(opcoes.tetoDiario)).restante;
      limitarContexto(contexto, Math.min(65_000, saldo - SAIDA_MAXIMA_DA_WIKI), solicitadas);
      const tamanho = Buffer.byteLength(JSON.stringify(entradaDaDescoberta(contexto)), "utf8");
      if (tamanho > 65_000) throw new PropostaEditorialRecusada();
      reserva = await fila.reservar(trabalho, tamanho + SAIDA_MAXIMA_DA_WIKI, opcoes.tetoDiario);
      contabilizada = false; chamou = false;
      if (!reserva) { await fila.falhar(trabalho, "orcamento"); return { tipo: "orcamento" as const }; }
      sinal.throwIfAborted(); chamou = true;
      resultado = await gerar(contexto, sinal);
      await fila.confirmarConsumo(reserva, resultado.uso); contabilizada = true;
      const d = decisaoDaDescoberta(resultado.proposta, contexto)?.semPublicacao;
      if (etapa !== 0 || d?.tipoDePendencia !== "leitura_de_neuronio") break;
      for (const id of d.neuroniosALer) solicitadas.add(id);
      await lerDestinos(repo, contexto, d.neuroniosALer);
      const atual = await repo.obterNota(origem.id);
      if (!atual || atual.revisao !== origem.revisao) throw new ErroWiki("Entrada superada.", 409);
    }
    if (!resultado) throw new ErroWiki("Geração indisponível.");
    // O resultado já foi pago: daqui em diante só a posse e as revisões decidem se ele vale.
    const { publicacoes, descartadas, tentadas, revisar, decisao } = await prepararPublicacoes(repo, contexto, resultado.proposta);
    if (descartadas.length) console.info("[wiki] Propostas descartadas na validação.", { quantidade: descartadas.length, motivos: [...new Set(descartadas)] });
    const atualizadas = new Set(publicacoes.flatMap((p) => p.alvo ? [p.alvo.id] : []));
    // Só as dependentes que cabiam nas propostas desta chamada contam como vistas; as outras esperam a próxima onda.
    // Uma dependente com mais afirmações desatualizadas do que o modelo pode ver numa chamada não está avaliada: o que
    // ficou escondido continuaria sem revisão, e a síntese passaria a constar como em dia.
    const vistas = new Set(contexto.dependentes.filter((id) => contexto.candidatas.some((c) => c.nota.id === id && (c.obsoletas?.length ?? 0) <= LIMITE_DE_AFIRMACOES_VISIVEIS)));
    const desatualizadas = (await fila.conceitos()).filter((c) => dependeDeRevisaoAnterior(c, origem) && !atualizadas.has(c.notaId));
    // O modelo viu estas dependentes e não propôs mudança: ficam avaliadas para esta revisão, sem nova chamada.
    const avaliadas = desatualizadas.filter((c) => vistas.has(c.notaId) && !tentadas.has(c.notaId)).map((c) => c.notaId);
    // Ondas limitadas: dependentes ainda não vistas mantêm a origem na fila, sem declarar cobertura completa.
    const restantes = desatualizadas.some((c) => !vistas.has(c.notaId));
    await fila.concluir(trabalho, publicacoes, revisar || restantes ? trabalho.cursor : trecho.fim < origem.conteudo.length ? trecho.fim : null, revisar ? [] : avaliadas, revisar, decisao);
    return { tipo: "processado" as const, publicadas: publicacoes.length, descartadas: descartadas.length };
  } catch (erro) {
    const classificada = classificarFalha(erro);
    const { motivo } = classificada;
    // Cancelado ou falhado antes de enviar o pedido ao provedor: nada foi cobrado.
    const consumo = chamou ? classificada.consumo : SEM_COBRANCA;
    if (reserva && !contabilizada) await fila.confirmarConsumo(reserva, consumo);
    const categoria = descreverErro(erro);
    console.error("[wiki] Trabalho adiado.", { motivo, erro: categoria });
    await fila.falhar(trabalho, motivo, categoria, erro instanceof DecisaoEditorialAdiada ? erro.decisao : undefined);
    return { tipo: "adiado" as const, motivo };
  }
}
