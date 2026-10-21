import { ErroDeFerramenta } from "./erro-de-ferramenta";
import { ErroDeConfiguracao } from "./repositorio-de-notas/config";
import type { IdDeNota } from "./types";
import type { LeiturasDoAgente } from "./porta-de-escrita-do-agente";
/**
 * Ferramentas do Gemini para consultar e alterar as notas na fonte configurada.
 *
 * Isso é o coração do function calling: cada ferramenta tem uma *declaração*
 * (o que o modelo lê para decidir se e como usá-la) e uma *execução* (o código
 * que roda de verdade quando ele decide chamar). O modelo nunca toca no
 * banco — ele só pede, e este arquivo decide o que acontece.
 *
 * Escritas passam pela porta do repositório, com histórico e revisão otimista.
 *
 * As descrições abaixo são prompt: quanto mais claras, menos o modelo erra.
 */

import type { FunctionDeclaration } from "@google/genai";
import { normalizarPasta, normalizarTexto } from "./caminho-da-nota";
import { obterRepositorio } from "./repositorio-de-notas";
import type { RepositorioDeNotas } from "./repositorio-de-notas/tipos";
import { caminhoDaNota, resolverNotaDoAgente } from "./resolver-nota-do-agente";
import { escolherPortaDeEscrita } from "./porta-de-escrita-do-agente";

export const declaracoesDeFerramentas: FunctionDeclaration[] = [
  {
    name: "buscar_notas",
    description:
      "Busca notas por palavras-chave no título e no conteúdo, também nas tags e no caminho. " +
      "Use esta ferramenta PRIMEIRO, quase sempre, quando a pergunta for sobre o que o usuário estudou ou anotou. " +
      "Devolve trechos, não a nota inteira — se um resultado parecer relevante, chame ler_nota para ver tudo.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        consulta: {
          type: "string",
          description:
            "Palavras-chave do assunto. Prefira termos específicos ('protocolo TCP handshake') a frases inteiras.",
        },
        limite: {
          type: "integer",
          description: "Quantos resultados devolver (1 a 20). Padrão: 8.",
        },
      },
      required: ["consulta"],
    },
  },
  {
    name: "listar_notas",
    description:
      "Lista os caminhos de todas as notas, opcionalmente filtrando por pasta. " +
      "Use quando o usuário perguntar quais notas existem ou quiser navegar pela estrutura.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        pasta: {
          type: "string",
          description:
            "Pasta para filtrar, ex: 'Estudos/Redes'. Omita para listar todas as notas.",
        },
      },
      required: [],
    },
  },
  {
    name: "ler_nota",
    description:
      "Lê o conteúdo completo de uma nota. Use depois de buscar_notas, quando precisar " +
      "do texto inteiro para responder com precisão.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        caminho: {
          type: "string",
          description:
            "Caminho da nota, ex: 'Estudos/Redes/TCP.md'. O título sozinho também costuma funcionar.",
        },
      },
      required: ["caminho"],
    },
  },
  {
    name: "criar_nota",
    description:
      "Cria uma nota NOVA e registra a escrita no histórico. " +
      "Falha se já existir uma nota nesse caminho — nesse caso use editar_nota. " +
      "Escreva o conteúdo em Markdown, no estilo do Obsidian: um título '# ' no topo e " +
      "links internos no formato [[Nome da Nota]] quando fizer sentido conectar com outras notas.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        caminho: {
          type: "string",
          description:
            "Caminho completo com pasta, ex: 'Estudos/Redes/DNS.md'. Prefira pastas que já existem.",
        },
        conteudo: {
          type: "string",
          description: "Conteúdo completo da nota, em Markdown.",
        },
      },
      required: ["caminho", "conteudo"],
    },
  },
  {
    name: "editar_nota",
    description:
      "Altera uma nota que já existe e registra a escrita no histórico. " +
      "Use modo 'acrescentar' para adicionar conteúdo ao final, preservando o que já estava lá — " +
      "é o modo mais seguro. Use 'substituir' apenas quando o usuário pedir para reescrever a nota, " +
      "e nesse caso leia a nota antes para não perder informação sem querer.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        caminho: {
          type: "string",
          description: "Caminho da nota existente, ex: 'Estudos/Redes/TCP.md'.",
        },
        conteudo: {
          type: "string",
          description:
            "Em 'acrescentar', só o texto novo. Em 'substituir', o conteúdo final inteiro da nota.",
        },
        modo: {
          type: "string",
          enum: ["acrescentar", "substituir"],
          description: "Como aplicar o conteúdo.",
        },
      },
      required: ["caminho", "conteudo", "modo"],
    },
  },
];

/** O que a execução de uma ferramenta devolve. */
export type SaidaFerramenta = {
  /** Vai de volta para o Gemini como resultado da chamada */
  resposta: Record<string, unknown>;
  /** Vai para a interface, para o usuário ver o que aconteceu */
  resumo: string;
  erro?: boolean;
  notaId?: IdDeNota;
  /**
   * Notas tocadas pela ferramenta, na ordem em que importam (busca: ranking).
   * Só para a interface acender o grafo — NUNCA entra em `resposta`.
   */
  ids?: IdDeNota[];
};

type Args = Record<string, unknown>;

/**
 * Roda a ferramenta que o modelo pediu.
 *
 * Erros viram resultado normal (com a chave `erro`) em vez de exceção: o
 * Gemini lê a mensagem e costuma se corrigir sozinho — tentar outro caminho,
 * refazer a busca — o que é bem melhor do que derrubar a conversa inteira.
 */
export async function executarFerramenta(
  nome: string,
  args: Args,
  opcoes: { repositorio?: RepositorioDeNotas; leituras?: LeiturasDoAgente } = {},
): Promise<SaidaFerramenta> {
  try {
    const repositorio = opcoes.repositorio ?? await obterRepositorio();
    switch (nome) {
      case "buscar_notas":
        return await execBuscar(args, repositorio);
      case "listar_notas":
        return await execListar(args, repositorio);
      case "ler_nota":
        return await execLer(args, repositorio, opcoes.leituras);
      case "criar_nota":
        return await execCriar(args, repositorio);
      case "editar_nota":
        return await execEditar(args, repositorio, opcoes.leituras);
      default:
        return {
          resposta: { erro: `Ferramenta desconhecida: ${nome}` },
          resumo: `Ferramenta desconhecida: ${nome}`,
          erro: true,
        };
    }
  } catch (error) {
    const esperado = error instanceof ErroDeFerramenta || error instanceof ErroDeConfiguracao;
    if (!esperado) console.error(`[ferramenta:${nome}]`, error);
    const mensagem = esperado ? error.message : "Falha interna ao acessar as notas. Tente novamente.";
    return {
      resposta: { erro: mensagem },
      resumo: mensagem,
      erro: true,
    };
  }
}

async function execBuscar(args: Args, repositorio: RepositorioDeNotas): Promise<SaidaFerramenta> {
  const consulta = texto(args.consulta, "consulta");
  const limite = Math.min(Math.max(Math.floor(numero(args.limite) ?? 8), 1), 20);

  const resultados = await repositorio.buscarPorConteudo(consulta, limite);
  const aviso = await repositorio.obterAviso();

  return {
    resposta: {
      encontradas: resultados.length,
      ...(aviso ? { aviso } : {}),
      notas: resultados.map((r) => ({
        caminho: caminhoDaNota(r),
        titulo: r.titulo,
        trecho: r.trecho,
      })),
    },
    resumo:
      resultados.length === 0
        ? `Buscou "${consulta}" — nenhuma nota encontrada`
        : `Buscou "${consulta}" — ${resultados.length} nota(s)`,
    ids: resultados.map((r) => r.id),
  };
}

async function execListar(args: Args, repositorio: RepositorioDeNotas): Promise<SaidaFerramenta> {
  const pasta = args.pasta ? texto(args.pasta, "pasta") : undefined;
  const prefixo = normalizarTexto(normalizarPasta(pasta) ?? "");
  const notas = (await repositorio.listarResumos()).filter((nota) => normalizarTexto(nota.pasta ?? "").startsWith(prefixo));
  const aviso = await repositorio.obterAviso();

  // Não devolvemos milhares de caminhos para o modelo: gasta contexto à toa.
  const LIMITE = 200;

  return {
    resposta: {
      total: notas.length,
      ...((aviso || notas.length > LIMITE) ? {
        aviso: [aviso, notas.length > LIMITE ? `Mostrando os primeiros ${LIMITE} de ${notas.length}. Use buscar_notas para filtrar.` : undefined].filter(Boolean).join(" "),
      } : {}),
      caminhos: notas.slice(0, LIMITE).map(caminhoDaNota),
    },
    resumo: `Listou ${notas.length} nota(s)${pasta ? ` em "${pasta}"` : ""}`,
  };
}

async function execLer(args: Args, repositorio: RepositorioDeNotas, leituras?: LeiturasDoAgente): Promise<SaidaFerramenta> {
  const caminho = texto(args.caminho, "caminho");
  const resumo = resolverNotaDoAgente(caminho, await repositorio.listarResumos());
  if (!resumo) {
    return {
      resposta: {
        erro: `Nota "${caminho}" não encontrada. Use buscar_notas ou listar_notas para descobrir o caminho correto.`,
      },
      resumo: `Nota não encontrada: ${caminho}`,
      erro: true,
    };
  }

  const resultado = await repositorio.obterNota(resumo.id);
  if (!resultado) throw new ErroDeFerramenta(`A nota "${caminhoDaNota(resumo)}" sumiu entre a listagem e a leitura. Use listar_notas novamente.`);
  leituras?.set(resultado.id, resultado.revisao);

  return {
    resposta: {
      caminho: caminhoDaNota(resultado),
      titulo: resultado.titulo,
      conteudo: resultado.conteudo,
    },
    resumo: `Leu "${caminhoDaNota(resultado)}"`,
    ids: [resultado.id],
  };
}

async function execCriar(args: Args, repositorio: RepositorioDeNotas): Promise<SaidaFerramenta> {
  const caminho = texto(args.caminho, "caminho");
  const conteudo = texto(args.conteudo, "conteudo");

  const resultado = await escolherPortaDeEscrita(repositorio).criar(caminho, conteudo);

  return {
    resposta: {
      sucesso: true,
      caminho: resultado.caminho,
    },
    resumo: `Criou a nota "${resultado.caminho}"`,
    notaId: resultado.notaId,
    ids: [resultado.notaId],
  };
}

async function execEditar(args: Args, repositorio: RepositorioDeNotas, leituras?: LeiturasDoAgente): Promise<SaidaFerramenta> {
  const caminho = texto(args.caminho, "caminho");
  const conteudo = texto(args.conteudo, "conteudo");
  const modo = args.modo === "substituir" ? "substituir" : "acrescentar";

  const resultado = await escolherPortaDeEscrita(repositorio).editar(caminho, conteudo, modo, leituras);

  return {
    resposta: {
      sucesso: true,
      caminho: resultado.caminho,
      modo,
    },
    resumo: `${modo === "substituir" ? "Reescreveu" : "Complementou"} a nota "${resultado.caminho}"`,
    notaId: resultado.notaId,
    ids: [resultado.notaId],
  };
}

// O modelo às vezes manda número onde pedimos string, ou omite um campo
// obrigatório. Estas duas funções normalizam isso num ponto só.

function texto(valor: unknown, campo: string): string {
  if (typeof valor === "string" && valor.trim() !== "") return valor;
  if (typeof valor === "number") return String(valor);
  throw new ErroDeFerramenta(`O parâmetro "${campo}" é obrigatório e deve ser um texto.`);
}

function numero(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "" && !isNaN(Number(valor))) {
    return Number(valor);
  }
  return undefined;
}
