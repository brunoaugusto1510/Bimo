import type { NotaCompleta, RepositorioDeNotas } from "../repositorio-de-notas/tipos";
import { caminhoDaNota } from "../resolver-nota-do-agente";
import { localizarCitacao } from "./citacoes";
import { fonteConfere } from "./fontes";
import { comTermosDe, vizinhosDosNeuronios } from "./recuperacao";
import { estadoDaPagina } from "./servico";
import type { MetadadosWiki } from "./tipos";

/** Só devolve citações que continuam acessíveis e localizáveis no texto atual. */
export async function evidenciasDaWiki(repo: RepositorioDeNotas, id: string) {
  const meta = await repo.wiki?.obter(id); if (!meta) return null;
  const estado = await estadoDaPagina(repo, meta);
  const origens = new Map<string, NotaCompleta>();
  for (const fonte of meta.fontes) {
    const atual = await repo.obterNota(fonte.id);
    if (atual && fonteConfere(atual.conteudo, fonte)) origens.set(fonte.id, atual);
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

/**
 * O mapa da rede para o chat: cada neurônio com o resumo, a quem se liga e quem o cita (pelo caminho). É o índice que o
 * agente lê antes de escolher o que abrir. `consulta` filtra por termos no caminho e no resumo.
 */
export async function indiceDaWiki(repo: RepositorioDeNotas, consulta?: string) {
  const wiki = repo.wiki; if (!wiki) return null;
  const [paginas, resumos] = await Promise.all([wiki.listar(), repo.listarResumos()]);
  const notas = new Map(resumos.map((n) => [n.id, n]));
  // Sem nenhuma origem disponível o neurônio fica fora, como nas respostas.
  const vivas = paginas.filter((p) => notas.has(p.notaId) && p.fontes.some((f) => notas.has(f.id)));
  const caminho = (id: string) => caminhoDaNota(notas.get(id)!);
  const citadoPor = new Map<string, string[]>();
  for (const p of vivas) for (const id of p.estrutura.ligacoes) {
    if (id !== p.notaId && notas.has(id)) citadoPor.set(id, [...citadoPor.get(id) ?? [], p.notaId]);
  }
  // Uma consulta sem termo útil (só palavras comuns) não filtra: devolve o mapa inteiro.
  const casa = consulta ? comTermosDe(consulta) : null;
  return vivas.map((p) => ({ id: p.notaId, caminho: caminho(p.notaId), resumo: p.estrutura.resumo ?? p.afirmacoes[0]?.texto ?? null,
    ligaA: p.estrutura.ligacoes.filter((id) => id !== p.notaId && notas.has(id)).map(caminho),
    citadoPor: (citadoPor.get(p.notaId) ?? []).map(caminho) }))
    .filter((n) => !casa || casa(`${n.caminho} ${n.resumo ?? ""}`));
}

/** Neurônios lidos por inteiro numa consulta, e vizinhos deles mostrados só pelo caminho e resumo. */
const NEURONIOS_POR_CONSULTA = 4;
const RELACIONADOS_POR_CONSULTA = 6;

/** Uma síntese sem nenhuma nota de origem disponível fica fora das respostas até ganhar novas origens. */
async function temRaizes(repo: RepositorioDeNotas, meta: MetadadosWiki) {
  for (const fonte of meta.fontes) if (await repo.obterNota(fonte.id)) return true;
  return false;
}

export async function consultarConhecimentoWiki(repo: RepositorioDeNotas, consulta: string, ids: string[]) {
  const fila = repo.wiki?.automacao; if (!fila) return null;
  const conceitos = await fila.conceitos();
  // Palavra inteira (ou o plural simples) e sem palavras comuns: "com" não acha "comunicação", mas "tcp" acha a sigla.
  // Ordem de relevância antes do corte: o que a busca achou, depois título e apelidos, depois só o resumo.
  const casa = comTermosDe(consulta);
  const porTitulo: string[] = []; const porResumo: string[] = [];
  if (casa) for (const c of conceitos) {
    if (casa(`${c.chave} ${c.aliases.join(" ")}`)) porTitulo.push(c.notaId);
    else if (casa(c.resumo ?? "")) porResumo.push(c.notaId);
  }
  const alvos = new Set([...ids, ...porTitulo, ...porResumo]);
  const porId = new Map(conceitos.map((c) => [c.notaId, c]));
  const notas = []; const lidos = new Set<string>();
  for (const id of alvos) {
    const meta = await repo.wiki!.obter(id); if (!meta) continue;
    const nota = await repo.obterNota(id); if (!nota || !(await temRaizes(repo, meta))) continue;
    const evidencias = await evidenciasDaWiki(repo, id);
    notas.push({ caminho: caminhoDaNota(nota), revisao: nota.revisao, resumo: porId.get(id)?.resumo ?? null, ...evidencias,
      ...(evidencias?.estado === "atualizada" ? { sintese: nota.conteudo.slice(0, 4000) } : {}) });
    lidos.add(id);
    if (notas.length >= NEURONIOS_POR_CONSULTA) break;
  }
  // Um salto na rede, nos dois sentidos: o modelo vê o que está ao lado e pode ler com ler_nota.
  const vizinhos = vizinhosDosNeuronios(conceitos);
  const relacionados = [];
  for (const vizinho of new Set([...lidos].flatMap((id) => [...vizinhos.get(id) ?? []]))) {
    if (lidos.has(vizinho) || relacionados.length >= RELACIONADOS_POR_CONSULTA) continue;
    const meta = await repo.wiki!.obter(vizinho);
    const nota = await repo.obterNota(vizinho); if (!nota || !meta || !(await temRaizes(repo, meta))) continue;
    relacionados.push({ caminho: caminhoDaNota(nota), resumo: porId.get(vizinho)?.resumo ?? null });
  }
  return { cobertura: await fila.cobertura(), notas, relacionados,
    aviso: "A cobertura informa o processamento, não prova leitura de todo o acervo. Trabalho pendente ou impedido pode deixar lacunas." };
}
