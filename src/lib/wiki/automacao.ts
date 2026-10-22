import { z } from "zod";
import { normalizarTexto, validarTitulo, juntarCaminho } from "../caminho-da-nota";
import { descreverErro } from "../registro-de-erros";
import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";
import { ErroDaGeracaoWiki, ErroWiki, type AfirmacaoWiki, type FonteWiki, type MetadadosWiki, type PublicacaoWiki } from "./tipos";
import type { ConceitoWiki, ConsumoWiki, ContextoWiki, GeradorAutomaticoWiki, MotivoDaFalhaWiki } from "./automacao-tipos";
import { citacaoInsuficiente, localizarCitacao } from "./citacoes";
import { dependeDeRevisaoAnterior, palavrasEmComum, recuperarContexto } from "./recuperacao";

const esquemaDaProposta = z.object({
  titulo: z.string().trim().min(1).max(200), alvoId: z.string().nullable(),
  aliases: z.array(z.string().trim().min(1).max(100)).max(12),
  afirmacoes: z.array(z.object({ texto: z.string().trim().min(1).max(2000),
    natureza: z.enum(["explicita", "inferencia"]),
    evidencias: z.array(z.object({ fonteId: z.string(), citacao: z.string().min(1).max(2000) }).strict()).min(1).max(10),
  }).strict()).min(1).max(24), lacunas: z.array(z.string().max(1000)).max(10),
}).strict();
export const esquemaDaDescoberta = z.object({ propostas: z.array(esquemaDaProposta).max(3) }).strict();
/** O servidor valida o envelope e depois cada proposta: uma malformada não derruba as outras. */
const esquemaDoEnvelope = z.object({ propostas: z.array(z.unknown()).max(3) }).strict();
type PropostaWiki = z.infer<typeof esquemaDaProposta>;

const SEM_COBRANCA: ConsumoWiki = { entrada: 0, saida: 0 };

/** Payload limitado: os snapshots completos ficam no servidor, fora do contexto do modelo. */
export function entradaDaDescoberta(c: ContextoWiki) {
  return { origem: { id: c.origem.id, titulo: c.origem.titulo, revisao: c.origem.revisao, ...c.trecho },
    // Todas as sínteses por título e apelidos (as mais próximas da nota primeiro): reconhecer um conceito que a busca não trouxe.
    indice: c.indice,
    candidatas: c.candidatas.map((p) => ({ id: p.nota.id, titulo: p.nota.titulo, revisao: p.nota.revisao,
      gerenciada: Boolean(p.metadados), protegida: p.conceito?.protegida ?? false,
      // Síntese construída sobre uma revisão anterior desta origem: o modelo deve atualizá-la ou deixá-la como está.
      desatualizadaPelaOrigem: p.conceito ? dependeDeRevisaoAnterior(p.conceito, c.origem) : false,
      aliases: p.conceito?.aliases ?? [], texto: p.nota.conteudo.slice(0, 4000),
      afirmacoes: p.metadados?.afirmacoes.slice(0, 12),
    })),
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

type Descarte = "estrutura" | "titulo" | "alvo" | "protegida" | "evidencia" | "limite" | "repetida" | "titulo-em-uso";
/** `tentadas`: sínteses que o modelo quis atualizar; se a proposta foi descartada, não contam como avaliadas. */
type Preparo = { publicacoes: PublicacaoWiki[]; descartadas: Descarte[]; tentadas: Set<string> };

const escapar = (s: string) => s.replace(/[\\`*_{}[\]<>()!#|]/g, "\\$&").replace(/[\r\n]+/g, " ");
// Os caracteres que quebrariam uma ligação ou o caminho viram hífen ou espaço, em vez de custar a proposta.
const limparTitulo = (titulo: string) => titulo.replace(/[/\\]/g, "-").replace(/[[\]#^|\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const caminhoOcupado = (pasta: string | null, titulo: string) => `${(pasta ?? "").toLowerCase()}\n${titulo.toLowerCase()}`;

/** O título proposto ou, se a pasta já tiver uma nota assim (a própria origem, por exemplo), uma variante de síntese. */
function tituloLivre(titulo: string, pasta: string | null, ocupados: Set<string>) {
  return [titulo, `${titulo} (síntese)`].find((opcao) => validarTitulo(opcao).ok && !ocupados.has(caminhoOcupado(pasta, opcao))) ?? null;
}

/** Identidade já existente para o título: a chave exata ou, sem ambiguidade, um alias. */
function identidadeConhecida(conceitos: ConceitoWiki[], chave: string) {
  const exata = conceitos.find((c) => c.chave === chave);
  if (exata) return exata.notaId;
  const porAlias = conceitos.filter((c) => c.aliases.some((a) => normalizarTexto(a) === chave));
  return porAlias.length === 1 ? porAlias[0].notaId : undefined;
}

/** O que o modelo efetivamente recebeu de cada fonte: uma citação fora disso não pode ter sido lida. */
function textosDasEntradas(c: ContextoWiki) {
  const textos = new Map<string, string>([[c.origem.id, c.trecho.texto]]);
  for (const candidata of entradaDaDescoberta(c).candidatas) {
    if (!candidata.gerenciada) textos.set(candidata.id, candidata.texto);
    for (const a of candidata.afirmacoes ?? []) for (const e of a.evidencias) {
      textos.set(e.fonteId, `${textos.get(e.fonteId) ?? ""}\n${e.citacao}`);
    }
  }
  return textos;
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

function localizarEvidencia(e: { fonteId: string; citacao: string }, fontes: Map<string, FonteWiki>, textos: Map<string, string>, c: ContextoWiki) {
  const fonte = fontes.get(e.fonteId); const lido = textos.get(e.fonteId);
  if (!fonte || !lido || citacaoInsuficiente(e.citacao, lido)) return null;
  const naJanela = localizarCitacao(lido, e.citacao);
  if (!naJanela) return null;
  // A posição vale onde o modelo leu: o trecho da origem, ou o prefixo da candidata. Só sem janela contígua busca na nota toda.
  const posicao = e.fonteId === c.origem.id ? { inicio: naJanela.inicio + c.trecho.inicio, fim: naJanela.fim + c.trecho.inicio }
    : fonte.conteudo.startsWith(lido) ? naJanela : localizarCitacao(fonte.conteudo, e.citacao);
  // Guarda o trecho original, não a cópia do modelo: a evidência continua localizável por posição.
  return posicao && { fonteId: e.fonteId, citacao: fonte.conteudo.slice(posicao.inicio, posicao.fim), ...posicao };
}

async function prepararProposta(repo: RepositorioDeNotas, c: ContextoWiki, p: PropostaWiki,
  conceitos: ConceitoWiki[], textos: Map<string, string>, ocupados: Set<string>): Promise<PublicacaoWiki | Descarte> {
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
  const conceito = conceitos.find((v) => v.notaId === alvoId);
  if (alvoId && (!alvo || !meta)) return "alvo";
  if (conceito?.protegida) return "protegida";
  const fontes = await fontesPermitidas(repo, c, meta);
  const novas: AfirmacaoWiki[] = [];
  for (const a of p.afirmacoes) {
    const evidencias = a.evidencias.map((e) => localizarEvidencia(e, fontes, textos, c));
    // Uma evidência sem suporte derruba a afirmação, não a proposta inteira.
    if (evidencias.some((e) => e === null)) continue;
    novas.push({ ...a, evidencias: evidencias.filter((e): e is NonNullable<typeof e> => e !== null) });
  }
  if (!novas.length) return "evidencia";
  // A atualização conserva afirmações anteriores ainda sustentadas por origens atuais.
  const preservadas: AfirmacaoWiki[] = [];
  for (const a of meta?.afirmacoes ?? []) {
    const evidencias = a.evidencias.flatMap((e) => {
      const fonte = fontes.get(e.fonteId);
      // Mesma tolerância das novas: espaços e marcação diferentes não apagam uma afirmação ainda sustentada.
      const posicao = fonte && localizarCitacao(fonte.conteudo, e.citacao);
      return fonte && posicao ? [{ ...e, citacao: fonte.conteudo.slice(posicao.inicio, posicao.fim), ...posicao }] : [];
    });
    if (evidencias.length === a.evidencias.length) preservadas.push({ ...a, evidencias });
  }
  const afirmacoes = [...new Map([...preservadas, ...novas].map((a) => [JSON.stringify(a), a])).values()];
  const usadas = new Set(afirmacoes.flatMap((a) => a.evidencias.map((e) => e.fonteId)));
  const raizes = [...fontes.values()].filter((f) => usadas.has(f.id));
  if (raizes.length > 10 || afirmacoes.length > 72) return "limite";
  const pasta = alvo ? alvo.pasta : c.origem.pasta;
  const nome = alvo?.titulo ?? tituloLivre(titulo.titulo, pasta, ocupados);
  if (!nome) return "titulo-em-uso";
  const conteudo = [`# ${nome}`, "Síntese do Bimo baseada nas anotações de origem. Inferências são interpretações.",
    ...afirmacoes.map((a) => `${a.natureza === "inferencia" ? "**Inferência:** " : ""}${escapar(a.texto)} ${a.evidencias.map((e) => `[${raizes.findIndex((f) => f.id === e.fonteId) + 1}]`).join(" ")}`),
    ...(p.lacunas.length ? ["## Questões em aberto", ...p.lacunas.map((v) => `- ${escapar(v)}`)] : []),
    "## Notas de origem", ...raizes.map((f, i) => `${i + 1}. [[${juntarCaminho(f.pasta, f.titulo)}]] — revisão ${f.revisao}`),
  ].join("\n\n");
  return { titulo: nome, conteudo, fontes: raizes, afirmacoes,
    alvo: alvo ? { id: alvo.id, revisao: alvo.revisao } : null, pasta,
    conceito: { chave: conceito?.chave ?? chave, aliases: [...new Set([...(conceito?.aliases ?? []), ...p.aliases])].slice(0, 24) },
  };
}

/** Cada proposta é validada sozinha: uma citação ruim não joga fora o resultado pago das outras. */
async function prepararPublicacoes(repo: RepositorioDeNotas, c: ContextoWiki, bruto: unknown): Promise<Preparo> {
  const envelope = esquemaDoEnvelope.parse(bruto);
  const conceitos = await repo.wiki!.automacao!.conceitos();
  const ocupados = new Set((await repo.listarResumos()).map((n) => caminhoOcupado(n.pasta, n.titulo)));
  const textos = textosDasEntradas(c);
  const preparo: Preparo = { publicacoes: [], descartadas: [], tentadas: new Set() };
  for (const bruta of envelope.propostas) {
    const valida = esquemaDaProposta.safeParse(bruta);
    if (!valida.success) { preparo.descartadas.push("estrutura"); continue; }
    const p = valida.data;
    const resultado = await prepararProposta(repo, c, p, conceitos, textos, ocupados);
    const tentada = p.alvoId ?? identidadeConhecida(conceitos, normalizarTexto(limparTitulo(p.titulo)));
    if (tentada) preparo.tentadas.add(tentada);
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
    const vistas = new Set(contexto.dependentes.filter((id) => contexto.candidatas.some((c) => c.nota.id === id)));
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
