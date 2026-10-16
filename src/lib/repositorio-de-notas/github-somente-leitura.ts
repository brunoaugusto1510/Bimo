/**
 * As notas que ainda moram no repositório do GitHub, vistas pelo contrato novo
 * — só leitura. Existe para a transição: a interface nova funciona (em modo
 * leitura) enquanto o banco não está pronto, e some depois do corte.
 *
 * Embrulha `vault-real.ts`, que continua dono do cache e da fala com a API do
 * GitHub. Nada aqui escreve: o agente ainda grava direto por `vault-real.ts`
 * até a troca de fonte.
 */

import { dividirCaminho } from "../caminho-da-nota";
import { CONFIGURACAO_PADRAO, lerConfiguracaoDoGrafo, type ConfiguracaoDoGrafo } from "../fisica-do-grafo";
import { getGitHubConfig, readFile } from "../github";
import {
  buscarNotas,
  invalidarCache,
  lerConteudoDaNota,
  marcaDoCache,
  obterNotasPlanas,
  type NotaPlana,
} from "../vault-real";
import type { IdDeNota, NotaCompleta, RepositorioDeNotas, ResumoDeNota } from "./tipos";

/** Teto de notas cujo conteúdo baixamos para achar links — protege repositórios enormes. */
const MAX_NOTAS_COM_CONTEUDO = 800;
/** Quantos downloads de nota rodam ao mesmo tempo. */
const CONCORRENCIA = 8;
/** Onde o Obsidian guarda as opções do grafo, relativo à raiz do repositório de notas. */
const CAMINHO_DA_CONFIGURACAO = ".obsidian/graph.json";

/**
 * O id de uma nota do GitHub é o caminho do arquivo em base64url: sem barras
 * (cabe numa rota `[id]`) e sem `:` (não colide com `tag:x` nem `nao-resolvida:x`
 * do grafo). A interface não deve interpretá-lo — só devolvê-lo.
 */
export function codificarIdDoGithub(caminho: string): IdDeNota {
  return Buffer.from(caminho, "utf8").toString("base64url");
}

/** `null` quando o texto não é um id que `codificarIdDoGithub` teria gerado. */
export function decodificarIdDoGithub(id: IdDeNota): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;

  const caminho = Buffer.from(id, "base64url").toString("utf8");
  return codificarIdDoGithub(caminho) === id ? caminho : null;
}

function paraResumo(nota: NotaPlana): ResumoDeNota {
  const { pasta, titulo } = dividirCaminho(nota.caminho);
  return { id: codificarIdDoGithub(nota.caminho), titulo, pasta, tags: [], criadoEm: null, atualizadoEm: null, revisao: 0 };
}

/**
 * Lê o `.obsidian/graph.json` — que fica na raiz do repositório de notas, ou
 * seja, em `VAULT_SUBPATH` quando ele está definido. Qualquer problema —
 * arquivo fora do repositório (muita gente põe `.obsidian/` no `.gitignore`),
 * JSON quebrado, falha de rede — cai nos padrões do Obsidian: é só aparência,
 * e não vale derrubar o grafo por ela. Erro de configuração do GitHub também
 * cai aqui, mas não se perde: `obterNotasPlanas`, que roda junto, falha com ele.
 */
export async function lerConfiguracaoDoGrafoNoGithub(): Promise<ConfiguracaoDoGrafo> {
  try {
    const cfg = getGitHubConfig();
    const caminho = cfg.subpath ? `${cfg.subpath}/${CAMINHO_DA_CONFIGURACAO}` : CAMINHO_DA_CONFIGURACAO;
    const texto = await readFile(cfg, caminho);
    return texto === null ? CONFIGURACAO_PADRAO : lerConfiguracaoDoGrafo(JSON.parse(texto));
  } catch {
    return CONFIGURACAO_PADRAO;
  }
}

/**
 * Baixa o conteúdo de várias notas ao mesmo tempo, limitado a `CONCORRENCIA` por vez.
 * Uma nota que falha (limite de requisições, rede) não derruba a lista: vem vazia, e
 * quem chama é avisado de quantas foram.
 */
async function baixarConteudos(notas: NotaPlana[]): Promise<{ conteudos: Map<string, string>; falhas: number }> {
  const conteudos = new Map<string, string>();
  const fila = [...notas];
  let falhas = 0;

  const trabalhadores = Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, async () => {
    while (fila.length > 0) {
      const nota = fila.shift();
      if (!nota) return;
      try {
        conteudos.set(nota.caminho, (await lerConteudoDaNota(nota.caminho)) ?? "");
      } catch {
        falhas++;
        conteudos.set(nota.caminho, "");
      }
    }
  });

  await Promise.all(trabalhadores);
  return { conteudos, falhas };
}

export function criarRepositorioDoGithub(): RepositorioDeNotas {
  /** Quantas notas a última leitura completa não conseguiu trazer. */
  let notasNaoLidas = 0;
  let avisoDaUltimaBusca: string | undefined;

  return {
    capacidades: { escrita: false, datas: false },

    marcaDeVersao: marcaDoCache,

    async obterAviso() {
      const { notas, aviso } = await obterNotasPlanas();
      const avisos = [
        aviso,
        avisoDaUltimaBusca,
        notas.length > MAX_NOTAS_COM_CONTEUDO
          ? `Há ${notas.length} notas; os links foram lidos só nas primeiras ${MAX_NOTAS_COM_CONTEUDO}.`
          : undefined,
        notasNaoLidas > 0
          ? `${notasNaoLidas} ${notasNaoLidas === 1 ? "nota não pôde ser lida" : "notas não puderam ser lidas"} agora; as ligações ${notasNaoLidas === 1 ? "dela podem faltar" : "delas podem faltar"} até a próxima tentativa.`
          : undefined,
      ].filter((texto): texto is string => Boolean(texto));

      return avisos.length > 0 ? avisos.join(" ") : undefined;
    },

    obterConfiguracaoDoGrafo: lerConfiguracaoDoGrafoNoGithub,

    async listarResumos() {
      const { notas } = await obterNotasPlanas();
      return notas.map(paraResumo);
    },

    async listarComConteudo() {
      const { notas } = await obterNotasPlanas();
      const { conteudos, falhas } = await baixarConteudos(notas.slice(0, MAX_NOTAS_COM_CONTEUDO));
      notasNaoLidas = falhas;
      // O que acabou de ser montado está incompleto: descartar o cache faz o serviço perceber
      // (a marca muda) e tentar de novo na próxima vez, em vez de guardar o buraco por 5 minutos.
      if (falhas > 0) invalidarCache();
      return notas.map((nota): NotaCompleta => ({ ...paraResumo(nota), conteudo: conteudos.get(nota.caminho) ?? "" }));
    },

    async obterNota(id) {
      const caminho = decodificarIdDoGithub(id);
      if (caminho === null) return null;

      const conteudo = await lerConteudoDaNota(caminho);
      if (conteudo === null) return null;

      const { notas } = await obterNotasPlanas();
      const nota = notas.find((candidata) => candidata.caminho === caminho);
      return nota ? { ...paraResumo(nota), conteudo } : null;
    },

    async buscarPorConteudo(consulta, limite) {
      const { resultados, aviso } = await buscarNotas(consulta, limite);
      avisoDaUltimaBusca = aviso;
      return resultados.map((resultado) => ({
        id: codificarIdDoGithub(resultado.caminho),
        titulo: resultado.titulo,
        pasta: dividirCaminho(resultado.caminho).pasta,
        trecho: resultado.trecho,
      }));
    },

    async criarNota() {
      return { tipo: "somente-leitura" };
    },

    async atualizarNota() {
      return { tipo: "somente-leitura" };
    },

    async renomearNota() {
      return { tipo: "somente-leitura" };
    },
  };
}
