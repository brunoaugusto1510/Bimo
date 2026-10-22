import { z } from "zod";
import { juntarCaminho, validarTitulo } from "../caminho-da-nota";
import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";
import { mesmoConteudo } from "./citacoes";
import { conferirFontes, ErroWiki, type FonteWiki, type MetadadosWiki } from "./tipos";

export const esquemaDoPedidoWiki = z.object({
  titulo: z.string().trim().min(1).max(200), fontes: z.array(z.string().min(1).max(100)).min(1).max(10),
  paginaId: z.string().min(1).max(100).optional(), revisaoBase: z.number().int().positive().optional(),
}).strict().refine((v) => Boolean(v.paginaId) === Boolean(v.revisaoBase), "A atualização precisa da página e da revisão.");
const esquemaDaProposta = z.object({
  afirmacoes: z.array(z.object({
    texto: z.string().trim().min(1).max(2000), natureza: z.enum(["explicita", "inferencia"]),
    evidencias: z.array(z.object({ fonteId: z.string(), citacao: z.string().min(1).max(2000) }).strict()).min(1).max(10),
  }).strict()).min(1).max(24), lacunas: z.array(z.string().max(1000)).max(10),
}).strict();
export type PedidoWiki = z.infer<typeof esquemaDoPedidoWiki>;
export type ContextoDaSintese = { titulo: string; fontes: FonteWiki[]; anterior: string | null };
export type GeradorWiki = (contexto: ContextoDaSintese) => Promise<unknown>;

export function exigirWiki(repo: RepositorioDeNotas) {
  if (!repo.wiki) throw new ErroWiki("A Wiki Viva ainda não está habilitada neste ambiente.", 503);
  return repo.wiki;
}

export async function estadoDaPagina(repo: RepositorioDeNotas, meta: MetadadosWiki) {
  const nota = await repo.obterNota(meta.notaId);
  if (!nota) return "indisponivel" as const;
  // Na automação, renomear e mover acompanham a revisão gerenciada; só editar o texto a protege.
  const emDia = meta.gerencia ? !meta.gerencia.protegida && nota.revisao === meta.gerencia.revisao : nota.revisao === meta.revisaoPublicada;
  if (!emDia) return "edicao_manual" as const;
  for (const fonte of meta.fontes) {
    const atual = await repo.obterNota(fonte.id);
    // Vale o que a origem diz: renomeá-la ou movê-la não invalida a síntese.
    if (!atual || !mesmoConteudo(atual.conteudo, fonte.conteudo)) return "desatualizada" as const;
  }
  return "atualizada" as const;
}

export async function obterIndiceWiki(repo: RepositorioDeNotas) {
  const resumos = new Map((await repo.listarResumos()).map((n) => [n.id, n]));
  const indice = [];
  for (const meta of await exigirWiki(repo).listar()) {
    const nota = resumos.get(meta.notaId);
    if (nota) indice.push({ ...nota, estado: await estadoDaPagina(repo, meta), fontes: meta.fontes.length, origens: meta.fontes.map((f) => f.id) });
  }
  return indice;
}

const escapar = (texto: string) => texto.replace(/[\\`*_{}[\]<>()!#|]/g, "\\$&").replace(/[\r\n]+/g, " ");

export async function compilarWiki(repo: RepositorioDeNotas, bruto: PedidoWiki, gerar: GeradorWiki) {
  const pedido = esquemaDoPedidoWiki.parse(bruto);
  const wiki = exigirWiki(repo);
  const titulo = validarTitulo(pedido.titulo);
  if (!titulo.ok) throw new ErroWiki(titulo.motivo);
  if (!pedido.paginaId && (await repo.listarResumos()).some((n) => n.pasta?.toLowerCase() === "wiki" && n.titulo.toLowerCase() === titulo.titulo.toLowerCase())) {
    throw new ErroWiki("O título já existe na pasta da wiki. Escolha outro ou enriqueça a página existente.", 409);
  }
  let alvo = null; let anterior = null;
  const ids = new Set<string>();
  if (pedido.paginaId) {
    const meta = await wiki.obter(pedido.paginaId);
    const nota = await repo.obterNota(pedido.paginaId);
    if (!meta || !nota) throw new ErroWiki("Essa nota não é uma página gerenciada da wiki.");
    if (nota.revisao !== pedido.revisaoBase || meta.revisaoPublicada !== nota.revisao) throw new ErroWiki("A página foi editada. Preserve a edição manual e revise antes de recompilar.", 409);
    if (nota.titulo !== titulo.titulo) throw new ErroWiki("Recompile com o título atual da página.");
    meta.fontes.forEach((f) => ids.add(f.id));
    alvo = { id: nota.id, revisao: nota.revisao }; anterior = nota.conteudo;
  }
  pedido.fontes.forEach((id) => ids.add(id));
  if (ids.size > 10) throw new ErroWiki("O limite é de dez notas por compilação, incluindo as fontes anteriores.");
  const fontes: FonteWiki[] = [];
  for (const id of ids) {
    const nota = await repo.obterNota(id);
    if (!nota) throw new ErroWiki("Uma nota selecionada não está disponível.", 404);
    if (await wiki.obter(id)) throw new ErroWiki("Uma página derivada não pode ser usada como fonte.");
    fontes.push({ id, titulo: nota.titulo, pasta: nota.pasta, revisao: nota.revisao, conteudo: nota.conteudo });
  }
  if (fontes.some((f) => !f.conteudo.trim())) throw new ErroWiki("As notas selecionadas precisam ter conteúdo.");
  if (JSON.stringify({ fontes, anterior }).length > 60_000) throw new ErroWiki("As notas ultrapassam o limite de contexto desta compilação. Selecione notas menores.", 413);
  if (alvo) {
    const meta = (await wiki.obter(alvo.id))!;
    if (meta.fontes.length === fontes.length && meta.fontes.every((f, i) => f.id === fontes[i].id && f.revisao === fontes[i].revisao)) {
      return { tipo: "sem_mudanca" as const, nota: await repo.obterNota(alvo.id) };
    }
  }
  const proposta = esquemaDaProposta.parse(await gerar({ titulo: titulo.titulo, fontes, anterior }));
  const afirmacoes = proposta.afirmacoes.map((a) => ({ ...a, evidencias: a.evidencias.map((e) => {
    const fonte = fontes.find((f) => f.id === e.fonteId);
    const inicio = fonte?.conteudo.indexOf(e.citacao) ?? -1;
    if (inicio < 0) throw new ErroWiki("A síntese contém uma referência que não corresponde às notas selecionadas.", 422);
    return { ...e, inicio, fim: inicio + e.citacao.length };
  }) }));
  const conteudo = [`# ${titulo.titulo}`, "Síntese produzida pelo Bimo a partir das notas indicadas. Inferências precisam de revisão.",
    ...afirmacoes.map((a) => `${a.natureza === "inferencia" ? "**Inferência:** " : ""}${escapar(a.texto)} ${a.evidencias.map((e) => `[${fontes.findIndex((f) => f.id === e.fonteId) + 1}]`).join(" ")}`),
    ...(proposta.lacunas.length ? ["## Questões em aberto", ...proposta.lacunas.map((l) => `- ${escapar(l)}`)] : []),
    "## Notas de origem", ...fontes.map((f, i) => `${i + 1}. [[${juntarCaminho(f.pasta, f.titulo)}]] — revisão ${f.revisao}`),
  ].join("\n\n");
  // A verificação definitiva ocorre novamente dentro da publicação atômica.
  conferirFontes(fontes, await Promise.all(fontes.map((f) => repo.obterNota(f.id))), new Set());
  const resultado = await wiki.publicar({ titulo: titulo.titulo, conteudo, fontes, afirmacoes, alvo });
  if (resultado.tipo !== "ok") throw new ErroWiki("Não foi possível publicar: o título já existe ou a página foi alterada.", 409);
  return resultado;
}
