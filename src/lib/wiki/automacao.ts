import { z } from "zod";
import { normalizarTexto, validarTitulo, caminhoParaLigacao } from "../caminho-da-nota";
import { descreverErro } from "../registro-de-erros";
import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";
import { ErroDaGeracaoWiki, ErroWiki, type AfirmacaoWiki, type DivergenciaWiki, type FonteWiki, type MetadadosWiki, type PublicacaoWiki } from "./tipos";
import type { ConceitoWiki, ConsumoWiki, ContextoWiki, GeradorAutomaticoWiki, MotivoDaFalhaWiki } from "./automacao-tipos";
import { afirmacoesVisiveis, comId, garantirIds, LIMITE_DE_AFIRMACOES, LIMITE_DE_AFIRMACOES_VISIVEIS } from "./afirmacoes";
import { citacaoInsuficiente, localizarCitacao } from "./citacoes";
import { comPalavrasDe, dependeDeRevisaoAnterior, palavrasEmComum, recuperarContexto } from "./recuperacao";
import { verificarSinteses } from "./observabilidade";
import { estruturaCompativel } from "./estrutura";

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
  /** Ids de outras sínteses a que esta se liga (o que o modelo viu no índice ou nas candidatas); não são evidência. */
  // Sem teto aqui: o servidor guarda no máximo `LIMITE_DE_LIGACOES`, e um excesso não pode custar a proposta inteira.
  ligacoes: z.array(z.string()).default([]),
  ligacoesRetiradas: z.array(z.string()).max(32).default([]),
  /** Cada lado aponta para um id visível ou `nova:N` (posição na lista de acréscimos, a partir de 1). */
  divergencias: z.array(z.object({ a: ladoDaDivergencia, b: ladoDaDivergencia }).strict()).max(10).default([]),
  /** A lista completa de perguntas em aberto; vazia (ou só de espaços) numa síntese que já existe mantém as que ela tinha. */
  lacunas: z.array(z.string().max(1000)).max(10),
}).strict();
const LIMITE_DE_LIGACOES = 8;
/** O que se lê das ligações pedidas, para que uma lista enorme não vire uma enxurrada de consultas. */
const LIMITE_DE_PEDIDAS = 32;
export const esquemaDaDescoberta = z.object({ propostas: z.array(esquemaDaProposta).max(3) }).strict();
/** O servidor valida o envelope e depois cada proposta: uma malformada não derruba as outras. */
const esquemaDoEnvelope = z.object({ propostas: z.array(z.unknown()).max(3) }).strict();
type PropostaWiki = z.infer<typeof esquemaDaProposta>;

const SEM_COBRANCA: ConsumoWiki = { entrada: 0, saida: 0 };

/** Payload limitado: os snapshots completos ficam no servidor, fora do contexto do modelo. */
export function entradaDaDescoberta(c: ContextoWiki) {
  const relacionada = comPalavrasDe(c.trecho.texto);
  return { origem: { id: c.origem.id, titulo: c.origem.titulo, revisao: c.origem.revisao, ...c.trecho },
    // Todas as sínteses por título e apelidos (as mais próximas da nota primeiro): reconhecer um conceito que a busca não trouxe.
    indice: c.indice,
    candidatas: c.candidatas.map((p) => ({ id: p.nota.id, titulo: p.nota.titulo, revisao: p.nota.revisao,
      gerenciada: Boolean(p.metadados), protegida: Boolean(p.conceito?.protegida || p.conceito?.pausada), pausada: p.conceito?.pausada ?? false,
      // Síntese construída sobre uma revisão anterior desta origem: o modelo deve atualizá-la ou deixá-la como está.
      desatualizadaPelaOrigem: p.conceito ? dependeDeRevisaoAnterior(p.conceito, c.origem) : false,
      aliases: p.conceito?.aliases ?? [], texto: p.nota.conteudo.slice(0, 4000),
      // Com id: é por ele que o modelo mantém, substitui ou retira. As desatualizadas (a origem mudou) e as da origem vêm
      // primeiro; `totalDeAfirmacoes` diz o que ficou de fora.
      afirmacoes: p.metadados && afirmacoesVisiveis(garantirIds(p.metadados.afirmacoes), { origemId: c.origem.id, obsoletas: new Set(p.obsoletas), relacionada })
        .map((a) => (p.obsoletas?.includes(a.id) ? { ...a, desatualizada: true } : a)),
      totalDeAfirmacoes: p.metadados?.afirmacoes.length,
      // O que a síntese já liga e as perguntas que ela ainda tem em aberto: o modelo devolve a lista completa das perguntas.
      ligacoes: p.metadados?.estrutura?.ligacoes,
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

type Descarte = "estrutura" | "titulo" | "alvo" | "protegida" | "evidencia" | "limite" | "repetida" | "titulo-em-uso" | "sem-mudanca";
/**
 * `tentadas`: sínteses que o modelo quis atualizar; se a proposta foi descartada, não contam como avaliadas.
 * Exceção: "sem-mudanca" é uma decisão (a síntese já diz isso), então a síntese conta como avaliada.
 */
type Preparo = { publicacoes: PublicacaoWiki[]; descartadas: Descarte[]; tentadas: Set<string> };

/** Ids que o modelo recebeu de cada síntese (`ids`) e quais delas estavam marcadas como desatualizadas (`obsoletas`). */
type Visiveis = Map<string, { ids: Set<string>; obsoletas: Set<string> }>;
/** Forma canônica das afirmações, estável mesmo depois de passar pelo jsonb (que reordena as chaves). */
const assinatura = (afirmacoes: AfirmacaoWiki[]) => JSON.stringify(afirmacoes.map((a) =>
  [a.id, a.natureza, a.evidencias.map((e) => [e.fonteId, e.inicio, e.fim, e.citacao])]));

const escapar = (s: string) => s.replace(/[\\`*_{}[\]<>()!#|]/g, "\\$&").replace(/[\r\n]+/g, " ");
// Os caracteres que quebrariam uma ligação ou o caminho viram hífen ou espaço, em vez de custar a proposta.
const limparTitulo = (titulo: string) => titulo.replace(/[/\\]/g, "-").replace(/[[\]#^|\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const caminhoOcupado = (pasta: string | null, titulo: string) => `${(pasta ?? "").toLowerCase()}\n${titulo.toLowerCase()}`;

/** O título proposto ou, se a pasta já tiver uma nota assim (a própria origem, por exemplo), uma variante de síntese. */
function tituloLivre(titulo: string, pasta: string | null, ocupados: Set<string>) {
  return [titulo, `${titulo} (síntese)`].find((opcao) => validarTitulo(opcao).ok && !ocupados.has(caminhoOcupado(pasta, opcao))) ?? null;
}

/**
 * As sínteses a que esta se liga: as que já tinha, que ainda existem, e as novas que o modelo pediu e viu (índice ou
 * candidatas). Sem repetição, sem ela mesma, no máximo oito. Id que não é de uma síntese (nota pessoal, inexistente) sai
 * sozinho: ligar é uma sugestão, e uma sugestão ruim não derruba a proposta.
 */
async function ligacoesDaSintese(repo: RepositorioDeNotas, c: ContextoWiki, pedidas: string[], existentes: string[], propria: string | null, retiradas: string[]) {
  const vistas = new Set([...c.indice.entradas.map((e) => e.id), ...c.candidatas.filter((v) => v.metadados).map((v) => v.nota.id)]);
  const conhecidas = new Set(c.candidatas.find((v) => v.nota.id === propria)?.metadados?.estrutura.ligacoes ?? []);
  const remover = new Set(retiradas.filter((id) => conhecidas.has(id)));
  const notas: { id: string; pasta: string | null; titulo: string }[] = [];
  for (const id of [...existentes, ...pedidas.slice(0, LIMITE_DE_PEDIDAS).filter((p) => vistas.has(p))]) {
    if (id === propria || remover.has(id) || notas.some((n) => n.id === id) || notas.length >= LIMITE_DE_LIGACOES) continue;
    const nota = await repo.obterNota(id);
    if (nota && await repo.wiki!.obter(id)) notas.push({ id, pasta: nota.pasta, titulo: nota.titulo });
  }
  return notas;
}

/** Identidade já existente para o título: a chave exata ou, sem ambiguidade, um alias. */
function identidadeConhecida(conceitos: ConceitoWiki[], chave: string) {
  const exata = conceitos.find((c) => c.chave === chave);
  if (exata) return exata.notaId;
  const porAlias = conceitos.filter((c) => c.aliases.some((a) => normalizarTexto(a) === chave));
  return porAlias.length === 1 ? porAlias[0].notaId : undefined;
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
  conceitos: ConceitoWiki[], textos: Leituras, ocupados: Set<string>, visiveis: Visiveis): Promise<PublicacaoWiki | Descarte> {
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
  const alvoId = p.alvoId ?? identidadeConhecida(conceitos, chave);
  const alvo = alvoId ? await repo.obterNota(alvoId) : null;
  const meta = alvoId ? await repo.wiki!.obter(alvoId) : null;
  if (meta && alvo) meta.estrutura = estruturaCompativel(meta.estrutura, alvo.conteudo);
  const conceito = conceitos.find((v) => v.notaId === alvoId);
  if (alvoId && (!alvo || !meta)) return "alvo";
  if (conceito?.protegida || conceito?.pausada) return "protegida";
  // As perguntas em aberto são a lista completa: vazia (ou só de espaços), numa síntese que já existe, mantém as que ela tinha.
  const pedidasEmAberto = p.lacunas.map((l) => l.trim()).filter(Boolean);
  const lacunas = pedidasEmAberto.length ? pedidasEmAberto : meta?.estrutura?.lacunas ?? [];
  const ligadas = await ligacoesDaSintese(repo, c, p.ligacoes, meta?.estrutura?.ligacoes ?? [], alvoId ?? null, p.ligacoesRetiradas);
  // Ligar a outra síntese ou mudar as perguntas é uma mudança por si só, mesmo sem afirmação nova: sem isso uma síntese
  // antiga nunca ganharia a ligação a uma criada depois.
  const mudaEstrutura = Boolean(alvoId) && (JSON.stringify(lacunas) !== JSON.stringify(meta?.estrutura?.lacunas ?? [])
    || JSON.stringify(ligadas.map((n) => n.id)) !== JSON.stringify(meta?.estrutura?.ligacoes ?? []));
  // Uma síntese que já existe e nenhuma operação pedida: o modelo a viu e decidiu não mudar nada. Isso é uma decisão,
  // não uma falha, e a síntese conta como avaliada em vez de travar a nota em chamadas repetidas.
  if (alvoId && !p.afirmacoes.length && !p.substituicoes.length && !p.retiradas.length && !p.divergencias.length && !mudaEstrutura) return "sem-mudanca";
  const fontes = await fontesPermitidas(repo, c, meta);
  const validar = (a: z.infer<typeof esquemaDaAfirmacao>): AfirmacaoWiki | null => {
    const evidencias = a.evidencias.map((e) => localizarEvidencia(e, fontes, textos, c));
    // Uma evidência sem suporte derruba a afirmação, não a proposta inteira.
    if (evidencias.some((e) => e === null)) return null;
    return comId({ ...a, evidencias: evidencias.filter((e): e is NonNullable<typeof e> => e !== null) });
  };
  const novasPorPosicao = p.afirmacoes.map(validar);
  const novas = novasPorPosicao.filter((a): a is AfirmacaoWiki => a !== null);
  // Manter, substituir ou retirar só vale numa síntese que já existe e só para o que o modelo viu (os ids que mostramos).
  const mostradas = visiveis.get(alvoId ?? "");
  const anteriores = garantirIds(meta?.afirmacoes ?? []);
  const idsAnteriores = new Set(anteriores.map((a) => a.id));
  // Remover ou trocar o que continua sustentado tem teto por proposta; o que já estava obsoleto (a origem mudou) não conta.
  // Sem isso, um modelo errado ou uma nota com instruções desfaria a síntese em poucas ondas.
  let orcamentoDeRemocoes = Math.max(3, Math.ceil(anteriores.length / 4));
  const podeMexer = (id: string) => mostradas?.obsoletas.has(id) || orcamentoDeRemocoes-- > 0;
  const substituicoes = new Map<string, AfirmacaoWiki>();
  for (const s of alvoId ? p.substituicoes : []) {
    if (!mostradas?.ids.has(s.id) || substituicoes.has(s.id)) continue;
    const nova = validar(s.afirmacao);
    // Substituição com evidência sem suporte não vale: a afirmação antiga continua no lugar. Também não vale trocar por
    // algo que a síntese já tem (ou que outra troca já produziu): isso só apagaria a antiga, e em ondas esvaziaria tudo.
    if (!nova || (nova.id !== s.id && (idsAnteriores.has(nova.id) || [...substituicoes.values()].some((v) => v.id === nova.id)))) continue;
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
  if (!novas.length && !substituicoes.size && !retiradas.size && !mudaEstrutura && !p.divergencias.length) return "evidencia";
  // O que nenhuma operação cita é mantido, desde que a evidência ainda exista nas origens atuais.
  const preservadas: AfirmacaoWiki[] = [];
  for (const a of anteriores) {
    if (retiradas.has(a.id) || substituicoes.has(a.id)) continue;
    const evidencias = a.evidencias.flatMap((e) => {
      const fonte = fontes.get(e.fonteId);
      // Mesma tolerância das novas: espaços e marcação diferentes não apagam uma afirmação ainda sustentada.
      const posicao = fonte && localizarCitacao(fonte.conteudo, e.citacao);
      return fonte && posicao ? [{ ...e, citacao: fonte.conteudo.slice(posicao.inicio, posicao.fim), ...posicao }] : [];
    });
    if (evidencias.length === a.evidencias.length) preservadas.push({ ...a, evidencias });
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
  // Uma troca ou retirada desfaz pares que já não existem. Um par preservado mantém os contextos anteriores.
  for (const d of meta?.estrutura.divergencias ?? []) manter(d);
  const resolver = (id: string) => /^nova:[1-9]\d?$/.test(id) ? novasPorPosicao[Number(id.slice(5)) - 1]?.id
    : mostradas?.ids.has(id) ? id : undefined;
  for (const d of p.divergencias) {
    const a = resolver(d.a.afirmacaoId); const b = resolver(d.b.afirmacaoId);
    if (a && b) manter({ a: { ...d.a, afirmacaoId: a }, b: { ...d.b, afirmacaoId: b } });
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
  if (alvo && conteudo === alvo.conteudo && aliases.length === (conceito?.aliases.length ?? 0) && assinatura(afirmacoes) === assinatura(anteriores)) return "sem-mudanca";
  return { titulo: nome, conteudo, fontes: raizes, afirmacoes, ligacoes: ligadas.map((n) => n.id), destinos: ligadas, lacunas, divergencias,
    alvo: alvo ? { id: alvo.id, revisao: alvo.revisao } : null, pasta,
    conceito: { chave: conceito?.chave ?? chave, aliases },
  };
}

/** Cada proposta é validada sozinha: uma citação ruim não joga fora o resultado pago das outras. */
async function prepararPublicacoes(repo: RepositorioDeNotas, c: ContextoWiki, bruto: unknown): Promise<Preparo> {
  const envelope = esquemaDoEnvelope.parse(bruto);
  const conceitos = await repo.wiki!.automacao!.conceitos();
  const ocupados = new Set((await repo.listarResumos()).map((n) => caminhoOcupado(n.pasta, n.titulo)));
  const textos = textosDasEntradas(c);
  // Os ids de afirmação que o modelo recebeu, por síntese: só com eles ele pode retirar ou substituir.
  const visiveis: Visiveis = new Map(entradaDaDescoberta(c).candidatas.flatMap((v) => v.afirmacoes ? [[v.id, {
    ids: new Set(v.afirmacoes.map((a) => a.id)),
    obsoletas: new Set(v.afirmacoes.filter((a) => "desatualizada" in a).map((a) => a.id)),
  }] as const] : []));
  const preparo: Preparo = { publicacoes: [], descartadas: [], tentadas: new Set() };
  for (const bruta of envelope.propostas) {
    const valida = esquemaDaProposta.safeParse(bruta);
    if (!valida.success) { preparo.descartadas.push("estrutura"); continue; }
    const p = valida.data;
    const resultado = await prepararProposta(repo, c, p, conceitos, textos, ocupados, visiveis);
    const tentada = p.alvoId ?? identidadeConhecida(conceitos, normalizarTexto(limparTitulo(p.titulo)));
    if (tentada && resultado !== "sem-mudanca") preparo.tentadas.add(tentada);
    if (typeof resultado === "string") { preparo.descartadas.push(resultado); continue; }
    const identidade = resultado.alvo?.id ?? resultado.conceito!.chave;
    if (preparo.publicacoes.some((q) => (q.alvo?.id ?? q.conceito!.chave) === identidade)) { preparo.descartadas.push("repetida"); continue; }
    if (!resultado.alvo) ocupados.add(caminhoOcupado(resultado.pasta ?? null, resultado.titulo));
    preparo.publicacoes.push(resultado);
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
  return { motivo: "temporario", consumo: null };
}

/** Um lote curto. A fila persistente é a fonte de verdade, não o tempo de vida da requisição. */
export async function processarWiki(repo: RepositorioDeNotas, gerar: GeradorAutomaticoWiki, opcoes: { tetoDiario: number; sinal?: AbortSignal }) {
  const fila = repo.wiki?.automacao;
  if (!fila) return { tipo: "desligado" as const };
  await verificarSinteses(repo);
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
    // Um byte por token é uma reserva conservadora, não uma medição de tokenização.
    // Primeiro as candidatas; só depois o índice, das entradas menos próximas da nota para as mais.
    while (Buffer.byteLength(JSON.stringify(entradaDaDescoberta(contexto)), "utf8") > 65_000) {
      if (contexto.candidatas.length) contexto.candidatas.pop();
      else if (contexto.indice.entradas.length) contexto.indice.entradas.pop();
      else break;
    }
    const quantidade = Buffer.byteLength(JSON.stringify(entradaDaDescoberta(contexto)), "utf8") + 8192 + 4096;
    reserva = await fila.reservar(trabalho, quantidade, opcoes.tetoDiario);
    if (!reserva) { await fila.falhar(trabalho, "orcamento"); return { tipo: "orcamento" as const }; }
    const sinal = opcoes.sinal ? AbortSignal.any([opcoes.sinal, AbortSignal.timeout(40_000)]) : AbortSignal.timeout(40_000);
    sinal.throwIfAborted();
    chamou = true;
    const resultado = await gerar(contexto, sinal);
    await fila.confirmarConsumo(reserva, resultado.uso); contabilizada = true;
    // O resultado já foi pago: daqui em diante só a posse e as revisões decidem se ele vale.
    const { publicacoes, descartadas, tentadas } = await prepararPublicacoes(repo, contexto, resultado.proposta);
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
    await fila.concluir(trabalho, publicacoes, restantes ? trabalho.cursor : trecho.fim < origem.conteudo.length ? trecho.fim : null, avaliadas);
    return { tipo: "processado" as const, publicadas: publicacoes.length, descartadas: descartadas.length };
  } catch (erro) {
    const classificada = classificarFalha(erro);
    const { motivo } = classificada;
    // Cancelado ou falhado antes de enviar o pedido ao provedor: nada foi cobrado.
    const consumo = chamou ? classificada.consumo : SEM_COBRANCA;
    if (reserva && !contabilizada) await fila.confirmarConsumo(reserva, consumo);
    const categoria = descreverErro(erro);
    console.error("[wiki] Trabalho adiado.", { motivo, erro: categoria });
    await fila.falhar(trabalho, motivo, categoria);
    return { tipo: "adiado" as const, motivo };
  }
}
