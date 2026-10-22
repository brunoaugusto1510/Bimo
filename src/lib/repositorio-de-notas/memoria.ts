/**
 * O repositório que vive na memória do processo. Serve a testes, a
 * desenvolvimento sem banco e aos testes de ponta a ponta — nunca a produção
 * (`config.ts` recusa `NOTAS_FONTE=memoria` lá).
 *
 * Cumpre o mesmo contrato do banco (a suíte de contrato roda contra os dois):
 * título único por pasta, revisão para concorrência otimista e renomeação que
 * reescreve as ligações.
 */

import { adotarGrafiaDaPasta, normalizarPasta, normalizarTexto } from "../caminho-da-nota";
import { CONFIGURACAO_PADRAO } from "../fisica-do-grafo";
import { trechoAoRedor } from "../markdown-da-nota";
import { planejarMudanca, planejarRenomeacao } from "./renomeacao";
import { NOTAS_DE_EXEMPLO } from "./semente";
import { conferirFontes, ErroWiki, type MetadadosWiki } from "../wiki/tipos";
import type { PublicacaoWiki } from "../wiki/tipos";
import { criarFilaWikiEmMemoria } from "../wiki/fila-memoria";
import type {
  EntradaDeNota,
  IdDeNota,
  NotaCompleta,
  RepositorioDeNotas,
  ResultadoDeBusca,
  ResultadoDeEscrita,
  ResultadoDeRenomeacao,
  ResumoDeNota,
} from "./tipos";

/** Tamanho do trecho devolvido pela busca, em volta do primeiro termo. */
const RAIO_DO_TRECHO_DA_BUSCA = 80;

/** Cópia que quem recebe pode alterar sem mexer no que está guardado. */
function copiar(nota: NotaCompleta): NotaCompleta {
  return { ...nota, tags: [...nota.tags] };
}

/** O `conteudo` fica de fora de propósito: é o que separa um resumo de uma nota completa. */
function paraResumo(nota: NotaCompleta): ResumoDeNota {
  return {
    id: nota.id,
    titulo: nota.titulo,
    pasta: nota.pasta,
    tags: [...nota.tags],
    criadoEm: nota.criadoEm,
    atualizadoEm: nota.atualizadoEm,
    revisao: nota.revisao,
  };
}

/** Mesma chave do índice único do banco: pasta + título, sem diferenciar a caixa do título. */
function chaveDeTitulo(pasta: string | null, titulo: string): string {
  return `${pasta ?? ""}\n${titulo.toLowerCase()}`;
}

export function criarRepositorioEmMemoria(iniciais: readonly EntradaDeNota[] = []): RepositorioDeNotas {
  const notas = new Map<IdDeNota, NotaCompleta>();
  const paginas = new Map<string, MetadadosWiki>();
  const copiarWiki = (valor: MetadadosWiki) => JSON.parse(JSON.stringify(valor)) as MetadadosWiki;
  let proximoId = 1;
  let versao = 0;

  const agora = () => new Date().toISOString();
  /** As pastas em uso. `ignorar` tira a própria nota da conta: mudar só a caixa da pasta dela não pode "adotar" a grafia antiga. */
  const pastasExistentes = (ignorar?: IdDeNota) =>
    [...notas.values()].filter((nota) => nota.id !== ignorar).map((nota) => nota.pasta);

  function acharPorTitulo(pasta: string | null, titulo: string, ignorar?: IdDeNota): NotaCompleta | undefined {
    const chave = chaveDeTitulo(pasta, titulo);
    return [...notas.values()].find((nota) => nota.id !== ignorar && chaveDeTitulo(nota.pasta, nota.titulo) === chave);
  }

  function inserir(entrada: EntradaDeNota): ResultadoDeEscrita {
    const pasta = adotarGrafiaDaPasta(normalizarPasta(entrada.pasta), pastasExistentes());

    const existente = acharPorTitulo(pasta, entrada.titulo);
    if (existente) return { tipo: "titulo-em-uso", idExistente: existente.id };

    const momento = agora();
    const nota: NotaCompleta = {
      id: String(proximoId++),
      titulo: entrada.titulo,
      pasta,
      tags: [...(entrada.tags ?? [])],
      conteudo: entrada.conteudo ?? "",
      criadoEm: momento,
      atualizadoEm: momento,
      revisao: 1,
    };
    notas.set(nota.id, nota);
    versao++;
    return { tipo: "ok", nota: copiar(nota) };
  }

  function publicar(entrada: PublicacaoWiki): ResultadoDeEscrita {
    conferirFontes(entrada.fontes, entrada.fontes.map((f) => notas.get(f.id) ?? null), new Set(paginas.keys()));
    let resultado: ResultadoDeEscrita;
    if (entrada.alvo) {
      const nota = notas.get(entrada.alvo.id); const meta = paginas.get(entrada.alvo.id);
      if (!nota || !meta) throw new ErroWiki("Essa nota não é uma página gerenciada da wiki.");
      if (nota.revisao !== entrada.alvo.revisao) throw new ErroWiki("A página foi alterada. Preserve a edição manual.", 409);
      const nova = { ...nota, conteudo: entrada.conteudo, revisao: nota.revisao + 1, atualizadoEm: agora() };
      notas.set(nova.id, nova); versao++; resultado = { tipo: "ok", nota: copiar(nova) };
    } else resultado = inserir({ titulo: entrada.titulo, pasta: entrada.pasta, conteudo: entrada.conteudo });
    if (resultado.tipo === "ok") paginas.set(resultado.nota.id, copiarWiki({ notaId: resultado.nota.id, revisaoPublicada: resultado.nota.revisao, fontes: entrada.fontes, afirmacoes: entrada.afirmacoes }));
    return resultado;
  }
  const automacao = criarFilaWikiEmMemoria({ notas, paginas, publicarAtomico(publicacoes) {
    const antesNotas = new Map(notas); const antesPaginas = new Map(paginas); const antesVersao = versao; const antesId = proximoId;
    try {
      return publicacoes.map((p) => { const resultado = publicar(p); if (resultado.tipo !== "ok") throw new ErroWiki("Conflito na publicação.", 409); return resultado.nota.id; });
    } catch (erro) {
      notas.clear(); for (const [id, nota] of antesNotas) notas.set(id, nota);
      paginas.clear(); for (const [id, pagina] of antesPaginas) paginas.set(id, pagina);
      versao = antesVersao; proximoId = antesId; throw erro;
    }
  } });
  for (const entrada of iniciais) { const resultado = inserir(entrada); if (resultado.tipo === "ok") automacao.registrar(resultado.nota); }
  const comGerencia = (pagina: MetadadosWiki): MetadadosWiki => {
    const gerencia = automacao.gerencia(pagina.notaId);
    return gerencia ? { ...pagina, gerencia } : pagina;
  };

  return {
    capacidades: { escrita: true, datas: true },
    wiki: {
      automacao: automacao.fila,
      async listar() { return [...paginas.values()].map((pagina) => comGerencia(copiarWiki(pagina))); },
      async obter(id) { const pagina = paginas.get(id); return pagina ? comGerencia(copiarWiki(pagina)) : null; },
    },

    async marcaDeVersao() {
      return `memoria-${versao}`;
    },

    async obterAviso() {
      return undefined;
    },

    async obterConfiguracaoDoGrafo() {
      return CONFIGURACAO_PADRAO;
    },

    async listarResumos() {
      return [...notas.values()].map(paraResumo);
    },

    async listarComConteudo() {
      return [...notas.values()].map(copiar);
    },

    async obterNota(id) {
      const nota = notas.get(id);
      return nota ? copiar(nota) : null;
    },

    async buscarPorConteudo(consulta, limite) {
      const palavras = normalizarTexto(consulta).split(/\s+/).filter(Boolean);
      if (palavras.length === 0) return [];

      const resultados: (ResultadoDeBusca & { noTitulo: boolean })[] = [];
      for (const nota of notas.values()) {
        const titulo = normalizarTexto(nota.titulo);
        const conteudo = normalizarTexto(nota.conteudo);
        const tudo = `${titulo}\n${conteudo}`;
        if (!palavras.every((palavra) => tudo.includes(palavra))) continue;

        const posicao = conteudo.indexOf(palavras.find((palavra) => conteudo.includes(palavra)) ?? "");
        resultados.push({
          id: nota.id,
          titulo: nota.titulo,
          pasta: nota.pasta,
          trecho: trechoAoRedor(nota.conteudo, Math.max(posicao, 0), RAIO_DO_TRECHO_DA_BUSCA),
          noTitulo: palavras.some((palavra) => titulo.includes(palavra)),
        });
      }

      // Título que casa vale mais que texto que casa.
      resultados.sort((a, b) => Number(b.noTitulo) - Number(a.noTitulo));
      return resultados.slice(0, limite).map((resultado) => ({
        id: resultado.id,
        titulo: resultado.titulo,
        pasta: resultado.pasta,
        trecho: resultado.trecho,
      }));
    },

    async criarNota(entrada) {
      const resultado = inserir(entrada); if (resultado.tipo === "ok") automacao.registrar(resultado.nota); return resultado;
    },

    async atualizarNota(id, mudancas, { revisaoBase }) {
      const nota = notas.get(id);
      if (!nota) return { tipo: "nao-encontrada" };
      if (nota.revisao !== revisaoBase) return { tipo: "conflito", atual: copiar(nota) };

      const pasta =
        mudancas.pasta === undefined
          ? nota.pasta
          : adotarGrafiaDaPasta(normalizarPasta(mudancas.pasta), pastasExistentes(id));
      const conteudo = mudancas.conteudo ?? nota.conteudo;
      const tags = mudancas.tags ?? nota.tags;

      const mudou =
        pasta !== nota.pasta || conteudo !== nota.conteudo || tags.join("\n") !== nota.tags.join("\n");
      if (!mudou) return { tipo: "ok", nota: copiar(nota) };

      const existente = acharPorTitulo(pasta, nota.titulo, id);
      if (existente) return { tipo: "titulo-em-uso", idExistente: existente.id };

      const momento = agora();
      // Mudar de pasta muda o "Pasta/Título" que as ligações com caminho usam: as outras notas acompanham.
      // O planejamento vê o texto novo da própria nota, que pode ter ligações também.
      const reescritas =
        pasta === nota.pasta
          ? []
          : planejarMudanca(
              [...notas.values()].map((outra) => (outra.id === id ? { ...outra, conteudo } : outra)),
              id,
              { pasta },
            );
      for (const { id: idDaOutra, conteudo: novoConteudo } of reescritas.filter((r) => r.id !== id)) {
        const outra = notas.get(idDaOutra)!;
        notas.set(idDaOutra, { ...outra, conteudo: novoConteudo, atualizadoEm: momento, revisao: outra.revisao + 1 });
      }

      const atualizada: NotaCompleta = {
        ...nota,
        pasta,
        conteudo: reescritas.find((r) => r.id === id)?.conteudo ?? conteudo,
        tags: [...tags],
        atualizadoEm: momento,
        revisao: nota.revisao + 1,
      };
      notas.set(id, atualizada);
      automacao.registrar(atualizada, nota.conteudo !== conteudo ? "conteudo" : "organizacao");
      for (const reescrita of reescritas.filter((r) => r.id !== id)) automacao.registrar(notas.get(reescrita.id)!, "organizacao");
      versao++;
      return {
        tipo: "ok",
        nota: copiar(atualizada),
        ...(pasta !== nota.pasta ? { notasReescritas: reescritas.filter((r) => r.id !== id).length } : {}),
      };
    },

    async renomearNota(id, novoTitulo, { revisaoBase }): Promise<ResultadoDeRenomeacao> {
      const nota = notas.get(id);
      if (!nota) return { tipo: "nao-encontrada" };
      if (nota.revisao !== revisaoBase) return { tipo: "conflito", atual: copiar(nota) };
      if (novoTitulo === nota.titulo) return { tipo: "ok", nota: copiar(nota), notasReescritas: 0 };

      const existente = acharPorTitulo(nota.pasta, novoTitulo, id);
      if (existente) return { tipo: "titulo-em-uso", idExistente: existente.id };

      const reescritas = planejarRenomeacao([...notas.values()], id, novoTitulo);
      const momento = agora();

      for (const { id: idDaOutra, conteudo } of reescritas) {
        const outra = notas.get(idDaOutra)!;
        notas.set(idDaOutra, { ...outra, conteudo, atualizadoEm: momento, revisao: outra.revisao + 1 });
      }

      // A própria nota pode ter sido reescrita acima (ligação para si mesma): parte do que está guardado agora.
      const atual = notas.get(id)!;
      const renomeada: NotaCompleta = {
        ...atual,
        titulo: novoTitulo,
        atualizadoEm: momento,
        revisao: reescritas.some((r) => r.id === id) ? atual.revisao : atual.revisao + 1,
      };
      notas.set(id, renomeada);
      automacao.registrar(renomeada, "organizacao");
      for (const reescrita of reescritas.filter((r) => r.id !== id)) automacao.registrar(notas.get(reescrita.id)!, "organizacao");
      versao++;

      return {
        tipo: "ok",
        nota: copiar(renomeada),
        notasReescritas: reescritas.filter((r) => r.id !== id).length,
      };
    },
  };
}

/** Chave no `globalThis`: o Next empacota rotas e páginas separadas, e cada pacote teria o seu módulo — e as suas notas. */
const CHAVE_GLOBAL = Symbol.for("bimo.repositorio-em-memoria");
type ComRepositorioGlobal = typeof globalThis & { [CHAVE_GLOBAL]?: RepositorioDeNotas };

/** O repositório compartilhado do processo, já com as notas de exemplo. */
export function obterRepositorioEmMemoriaCompartilhado(): RepositorioDeNotas {
  const global = globalThis as ComRepositorioGlobal;
  global[CHAVE_GLOBAL] ??= criarRepositorioEmMemoria(NOTAS_DE_EXEMPLO);
  return global[CHAVE_GLOBAL];
}
