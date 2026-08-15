/**
 * As "ferramentas" que o Gemini pode chamar.
 *
 * Isso é o coração do function calling: cada ferramenta tem uma *declaração*
 * (o que o modelo lê para decidir se e como usá-la) e uma *execução* (o código
 * que roda de verdade quando ele decide chamar). O modelo nunca toca no
 * GitHub — ele só pede, e este arquivo decide o que acontece.
 *
 * As descrições abaixo são prompt: quanto mais claras, menos o modelo erra.
 */

import type { FunctionDeclaration } from "@google/genai";
import {
  buscarNotas,
  criarNota,
  editarNota,
  lerNota,
  listarNotas,
} from "./vault";

export const declaracoesDeFerramentas: FunctionDeclaration[] = [
  {
    name: "buscar_notas",
    description:
      "Busca notas do vault por palavras-chave, procurando no título, no caminho e no conteúdo. " +
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
      "Lista os caminhos das notas do vault, opcionalmente filtrando por pasta. " +
      "Use quando o usuário perguntar o que existe no vault, quiser navegar pela estrutura, " +
      "ou quando você precisar descobrir em que pasta salvar uma nota nova.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        pasta: {
          type: "string",
          description:
            "Pasta para filtrar, ex: 'Estudos/Redes'. Omita para listar o vault inteiro.",
        },
      },
      required: [],
    },
  },
  {
    name: "ler_nota",
    description:
      "Lê o conteúdo completo de uma nota. Use depois de buscar_notas, quando precisar " +
      "do texto inteiro para responder com precisão ou antes de editar uma nota.",
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
      "Cria uma nota NOVA no vault (gera um commit no repositório do GitHub). " +
      "Falha se já existir uma nota nesse caminho — nesse caso use editar_nota. " +
      "Escreva o conteúdo em Markdown, no estilo do Obsidian: um título '# ' no topo e " +
      "links internos no formato [[Nome da Nota]] quando fizer sentido conectar com outras notas.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        caminho: {
          type: "string",
          description:
            "Caminho completo com pasta, ex: 'Estudos/Redes/DNS.md'. Prefira pastas que já existem no vault.",
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
      "Altera uma nota que já existe (gera um commit no repositório do GitHub). " +
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
): Promise<SaidaFerramenta> {
  try {
    switch (nome) {
      case "buscar_notas":
        return await execBuscar(args);
      case "listar_notas":
        return await execListar(args);
      case "ler_nota":
        return await execLer(args);
      case "criar_nota":
        return await execCriar(args);
      case "editar_nota":
        return await execEditar(args);
      default:
        return {
          resposta: { erro: `Ferramenta desconhecida: ${nome}` },
          resumo: `Ferramenta desconhecida: ${nome}`,
          erro: true,
        };
    }
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    return {
      resposta: { erro: mensagem },
      resumo: mensagem,
      erro: true,
    };
  }
}

async function execBuscar(args: Args): Promise<SaidaFerramenta> {
  const consulta = texto(args.consulta, "consulta");
  const limite = Math.min(Math.max(numero(args.limite) ?? 8, 1), 20);

  const { resultados, aviso } = await buscarNotas(consulta, limite);

  return {
    resposta: {
      encontradas: resultados.length,
      ...(aviso ? { aviso } : {}),
      notas: resultados.map((r) => ({
        caminho: r.caminho,
        titulo: r.titulo,
        trecho: r.trecho,
      })),
    },
    resumo:
      resultados.length === 0
        ? `Buscou "${consulta}" — nenhuma nota encontrada`
        : `Buscou "${consulta}" — ${resultados.length} nota(s)`,
  };
}

async function execListar(args: Args): Promise<SaidaFerramenta> {
  const pasta = args.pasta ? texto(args.pasta, "pasta") : undefined;
  const notas = await listarNotas(pasta);

  // Não devolvemos 3.000 caminhos para o modelo: gasta contexto à toa.
  const LIMITE = 200;

  return {
    resposta: {
      total: notas.length,
      ...(notas.length > LIMITE
        ? { aviso: `Mostrando os primeiros ${LIMITE} de ${notas.length}. Use buscar_notas para filtrar.` }
        : {}),
      caminhos: notas.slice(0, LIMITE).map((n) => n.caminho),
    },
    resumo: `Listou ${notas.length} nota(s)${pasta ? ` em "${pasta}"` : ""}`,
  };
}

async function execLer(args: Args): Promise<SaidaFerramenta> {
  const caminho = texto(args.caminho, "caminho");
  const resultado = await lerNota(caminho);

  if (!resultado) {
    return {
      resposta: {
        erro: `Nota "${caminho}" não encontrada. Use buscar_notas ou listar_notas para descobrir o caminho correto.`,
      },
      resumo: `Nota não encontrada: ${caminho}`,
      erro: true,
    };
  }

  return {
    resposta: {
      caminho: resultado.nota.caminho,
      titulo: resultado.nota.titulo,
      conteudo: resultado.conteudo,
    },
    resumo: `Leu "${resultado.nota.caminho}"`,
  };
}

async function execCriar(args: Args): Promise<SaidaFerramenta> {
  const caminho = texto(args.caminho, "caminho");
  const conteudo = texto(args.conteudo, "conteudo");

  const resultado = await criarNota(caminho, conteudo);

  return {
    resposta: {
      sucesso: true,
      caminho: resultado.caminho,
      commit: resultado.commitUrl,
    },
    resumo: `Criou a nota "${resultado.caminho}"`,
  };
}

async function execEditar(args: Args): Promise<SaidaFerramenta> {
  const caminho = texto(args.caminho, "caminho");
  const conteudo = texto(args.conteudo, "conteudo");
  const modo = args.modo === "substituir" ? "substituir" : "acrescentar";

  const resultado = await editarNota(caminho, conteudo, modo);

  return {
    resposta: {
      sucesso: true,
      caminho: resultado.caminho,
      modo,
      commit: resultado.commitUrl,
    },
    resumo: `${modo === "substituir" ? "Reescreveu" : "Complementou"} a nota "${resultado.caminho}"`,
  };
}

// O modelo às vezes manda número onde pedimos string, ou omite um campo
// obrigatório. Estas duas funções normalizam isso num ponto só.

function texto(valor: unknown, campo: string): string {
  if (typeof valor === "string" && valor.trim() !== "") return valor;
  if (typeof valor === "number") return String(valor);
  throw new Error(`O parâmetro "${campo}" é obrigatório e deve ser um texto.`);
}

function numero(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() !== "" && !isNaN(Number(valor))) {
    return Number(valor);
  }
  return undefined;
}
