import { ErroDeFerramenta } from "./erro-de-ferramenta";
import type { IdDeNota } from "./types";
import { dividirCaminho, validarTitulo } from "./caminho-da-nota";
import { caminhoDaNota, resolverNotaDoAgente } from "./resolver-nota-do-agente";
import { codificarIdDoGithub } from "./repositorio-de-notas/github-somente-leitura";
import type { RepositorioDeNotas, ResultadoDeEscrita } from "./repositorio-de-notas/tipos";

type ModoDeEdicao = "acrescentar" | "substituir";
type EscritaLegada = { caminho: string; commitUrl: string };
export type LegadoDeEscrita = {
  criarNota(caminho: string, conteudo: string): Promise<EscritaLegada>;
  editarNota(caminho: string, conteudo: string, modo: ModoDeEdicao): Promise<EscritaLegada>;
};
type EscritaDoAgente = { caminho: string; notaId: IdDeNota; commitUrl?: string };
export type LeiturasDoAgente = Map<IdDeNota, number>;

type PortaDeEscrita = {
  criar(caminho: string, conteudo: string): Promise<EscritaDoAgente>;
  editar(caminho: string, conteudo: string, modo: ModoDeEdicao, leituras?: LeiturasDoAgente): Promise<EscritaDoAgente>;
};

async function exigirGravacao(repositorio: RepositorioDeNotas, resultado: ResultadoDeEscrita): Promise<EscritaDoAgente> {
  switch (resultado.tipo) {
    case "ok": return { caminho: caminhoDaNota(resultado.nota), notaId: resultado.nota.id };
    case "somente-leitura": throw new ErroDeFerramenta("As notas estão em modo leitura nesta configuração.");
    case "nao-encontrada": throw new ErroDeFerramenta("Nota não encontrada. Use buscar_notas ou listar_notas para descobrir o caminho correto.");
    case "conflito": throw new ErroDeFerramenta("A nota mudou durante a edição. Leia a nota novamente antes de tentar editar.");
    case "titulo-em-uso": {
      const existente = await repositorio.obterNota(resultado.idExistente);
      throw new ErroDeFerramenta(`Já existe uma nota com este título. Use editar_nota${existente ? ` em "${caminhoDaNota(existente)}"` : " no caminho existente"}.`);
    }
  }
}

function acrescentar(atual: string, novo: string): string {
  const quebra = atual.includes("\r\n") ? "\r\n" : "\n";
  const antes = atual.replace(/(?:\r?\n)+$/, "");
  const depois = novo.replace(/\r?\n/g, quebra).replace(/^(?:\r?\n)+|(?:\r?\n)+$/g, "");
  const conteudo = antes && depois ? `${antes}${quebra}${quebra}${depois}` : antes || depois;
  return `${conteudo}${quebra}`;
}

function portaDoRepositorio(repositorio: RepositorioDeNotas): PortaDeEscrita {
  return {
    async criar(caminho, conteudo) {
      const { pasta, titulo } = dividirCaminho(caminho);
      const validacao = validarTitulo(titulo);
      if (!validacao.ok) throw new ErroDeFerramenta(validacao.motivo);
      return exigirGravacao(repositorio, await repositorio.criarNota({ pasta, titulo: validacao.titulo, conteudo }, {
        criadoPor: "agente", ferramenta: "criar_nota",
      }));
    },
    async editar(caminho, conteudo, modo, leituras) {
      const resumo = resolverNotaDoAgente(caminho, await repositorio.listarResumos(), "escrita");
      let nota = resumo ? await repositorio.obterNota(resumo.id) : null;
      if (!nota) return exigirGravacao(repositorio, { tipo: "nao-encontrada" });
      const revisaoLida = exigirLeitura(nota.id, modo, leituras);
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const resultado = await repositorio.atualizarNota(nota.id, {
          conteudo: modo === "substituir" ? conteudo : acrescentar(nota.conteudo, conteudo),
        }, { revisaoBase: modo === "substituir" ? revisaoLida! : nota.revisao, autor: { criadoPor: "agente", ferramenta: "editar_nota" }, checkpoint: true });
        if (resultado.tipo !== "conflito" || modo === "substituir" || tentativa === 1) return exigirGravacao(repositorio, resultado);
        nota = resultado.atual;
      }
      throw new ErroDeFerramenta("A nota mudou durante a edição.");
    },
  };
}

/** Temporário: some no corte para o banco (Fase 10). */
function portaLegada(repositorio: RepositorioDeNotas, injetado?: LegadoDeEscrita): PortaDeEscrita {
  const carregar = async () => injetado ?? await import("./vault-real");
  function identificar(resultado: EscritaLegada): EscritaDoAgente {
    return { ...resultado, notaId: codificarIdDoGithub(resultado.caminho) };
  }
  return {
    async criar(caminho, conteudo) {
      const validacao = validarTitulo(dividirCaminho(caminho).titulo);
      if (!validacao.ok) throw new ErroDeFerramenta(validacao.motivo);
      return identificar(await (await carregar()).criarNota(caminho, conteudo));
    },
    async editar(caminho, conteudo, modo, leituras) {
      const nota = resolverNotaDoAgente(caminho, await repositorio.listarResumos(), "escrita");
      if (!nota) return exigirGravacao(repositorio, { tipo: "nao-encontrada" });
      exigirLeitura(nota.id, modo, leituras);
      return identificar(await (await carregar()).editarNota(caminhoDaNota(nota), conteudo, modo));
    },
  };
}

export function escolherPortaDeEscrita(repositorio: RepositorioDeNotas, legado?: LegadoDeEscrita): PortaDeEscrita {
  return repositorio.capacidades.escrita ? portaDoRepositorio(repositorio) : portaLegada(repositorio, legado);
}

function exigirLeitura(id: IdDeNota, modo: ModoDeEdicao, leituras?: LeiturasDoAgente): number | undefined {
  const revisao = leituras?.get(id);
  if (modo === "substituir" && revisao === undefined) {
    throw new ErroDeFerramenta("Chame ler_nota antes de substituir a nota nesta conversa.");
  }
  return revisao;
}
