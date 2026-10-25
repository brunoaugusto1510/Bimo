import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";
import { fonteConfere } from "./fontes";
import { ErroWiki, type MetadadosWiki } from "./tipos";

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
    if (!atual || !fonteConfere(atual.conteudo, fonte)) return "desatualizada" as const;
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
