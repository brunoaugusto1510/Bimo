import { normalizarTexto } from "../caminho-da-nota";
import type { NotaCompleta, RepositorioDeNotas } from "../repositorio-de-notas/tipos";
import { caminhoDaNota } from "../resolver-nota-do-agente";
import { localizarCitacao, mesmoConteudo } from "./citacoes";
import { estadoDaPagina } from "./servico";

/** Só devolve citações que continuam acessíveis e localizáveis no texto atual. */
export async function evidenciasDaWiki(repo: RepositorioDeNotas, id: string) {
  const meta = await repo.wiki?.obter(id); if (!meta) return null;
  const estado = await estadoDaPagina(repo, meta);
  const origens = new Map<string, NotaCompleta>();
  for (const fonte of meta.fontes) {
    const atual = await repo.obterNota(fonte.id);
    if (atual && mesmoConteudo(atual.conteudo, fonte.conteudo)) origens.set(fonte.id, atual);
  }
  const afirmacoes = meta.afirmacoes.slice(0, 12).flatMap((a) => {
    const evidencias = a.evidencias.flatMap((e) => {
      const origem = origens.get(e.fonteId);
      if (!origem) return [];
      // Uma ligação reescrita desloca as posições guardadas: relocaliza a citação no texto atual.
      const posicao = origem.conteudo.slice(e.inicio, e.fim) === e.citacao ? true : localizarCitacao(origem.conteudo, e.citacao) !== null;
      if (!posicao) return [];
      return [{ caminho: caminhoDaNota(origem), revisao: origem.revisao, citacao: e.citacao.slice(0, 700) }];
    });
    return evidencias.length !== a.evidencias.length ? [] : [{ texto: a.texto, natureza: a.natureza, evidencias }];
  });
  return { estado, afirmacoes, aviso: "Sínteses são derivadas. As anotações de origem são as evidências independentes; citações literais não garantem a conclusão." };
}

export async function consultarConhecimentoWiki(repo: RepositorioDeNotas, consulta: string, ids: string[]) {
  const fila = repo.wiki?.automacao; if (!fila) return null;
  const palavras = normalizarTexto(consulta).split(/\s+/).filter((p) => p.length >= 3);
  const conceitos = await fila.conceitos();
  const alvos = new Set(ids);
  for (const conceito of conceitos) if (palavras.some((p) => normalizarTexto(`${conceito.chave} ${conceito.aliases.join(" ")}`).includes(p))) alvos.add(conceito.notaId);
  const notas = [];
  for (const id of alvos) {
    const meta = await repo.wiki!.obter(id); if (!meta) continue;
    const nota = await repo.obterNota(id); if (!nota) continue;
    const evidencias = await evidenciasDaWiki(repo, id);
    notas.push({ caminho: caminhoDaNota(nota), revisao: nota.revisao, ...evidencias,
      ...(evidencias?.estado === "atualizada" ? { sintese: nota.conteudo.slice(0, 4000) } : {}) });
    if (notas.length >= 3) break;
  }
  return { cobertura: await fila.cobertura(), notas,
    aviso: "A cobertura informa o processamento, não prova leitura de todo o acervo. Trabalho pendente ou impedido pode deixar lacunas." };
}
