import { NextResponse } from "next/server";
import { responder, type PassoDoServidor } from "@/lib/agente";
import { exigirSessao } from "@/lib/autenticacao";
import { exigirMesmaOrigem, lerJsonComLimite, respostaDeErro, tratarErroDeRepositorio } from "@/lib/http-de-notas";
import { ErroDeConfiguracao } from "@/lib/repositorio-de-notas/config";
import type { Mensagem } from "@/lib/types";

/**
 * Rota do chat de verdade: recebe o histórico da conversa, chama o agente
 * (que decide se e quais ferramentas usar) e devolve a resposta final.
 *
 * A chave OpenAI é usada só no servidor pelo transporte do agente.
 * Rascunhos do editor e ingestão continuam com a configuração Gemini.
 */
export async function POST(request: Request) {
  // O `proxy.ts` já barra isso na borda; conferir aqui também é de propósito.
  // A doc do Next 16 avisa que uma mudança de `matcher` pode descobrir uma rota
  // sem ninguém notar — e esta gasta cota da OpenAI, além de ler as notas.
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;
  const outraOrigem = exigirMesmaOrigem(request);
  if (outraOrigem) return outraOrigem;

  const corpo = await lerJsonComLimite(request);
  if (!corpo.ok) return corpo.resposta;

  const mensagens = validarMensagens(corpo.dados);
  if (!mensagens) {
    return NextResponse.json(
      {
        erro:
          'Envie {"mensagens": [{"papel": "usuario"|"agente", "conteudo": "..."}]} ' +
          "com 1 a 40 mensagens, até 20 mil caracteres por mensagem e 80 mil no total.",
      },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY?.trim()) return respostaDeErro(503, "O Bimo está indisponível no momento. Tente mais tarde.");
  if (aceitaNdjson(request)) return respostaEmFluxo(mensagens, request.signal);

  try {
    const resultado = await responder(mensagens, { signal: request.signal });
    return NextResponse.json(resultado);
  } catch (erro) {
    // Configuração das notas faltando continua sendo explicada (503 com as variáveis); o resto é genérico e só vai ao log.
    if (erro instanceof ErroDeConfiguracao) return tratarErroDeRepositorio(erro, "POST /api/chat");
    console.error("[POST /api/chat] Falha ao responder à conversa.");
    return respostaDeErro(500, MENSAGEM_DE_FALHA);
  }
}

const MENSAGEM_DE_FALHA = "Não consegui responder agora. Tente de novo.";

function aceitaNdjson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").toLowerCase().includes("application/x-ndjson");
}

/** O texto que o modo JSON mostraria para este erro, sem detalhes internos. */
function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDeConfiguracao) return erro.message;
  console.error("[POST /api/chat] Falha ao responder à conversa.");
  return MENSAGEM_DE_FALHA;
}

function linhaDoPasso({ ferramenta, ids }: PassoDoServidor) {
  return {
    tipo: "passo",
    nome: ferramenta.nome,
    resumo: ferramenta.resumo,
    erro: ferramenta.erro === true,
    ids,
    argumentos: ferramenta.argumentos,
    ...(ferramenta.notaId ? { notaId: ferramenta.notaId } : {}),
  };
}

/**
 * Responde em NDJSON (uma linha JSON por evento): os passos do agente saem
 * conforme acontecem e a última linha é `resposta` ou `erro`. A validação já
 * foi feita antes, em JSON com status HTTP; daqui em diante o status é 200 e o
 * desfecho vai no corpo.
 */
function respostaEmFluxo(mensagens: Parameters<typeof responder>[0], sinal: AbortSignal): Response {
  const controle = new AbortController();
  const cancelar = () => controle.abort();
  sinal.addEventListener("abort", cancelar, { once: true });
  if (sinal.aborted) cancelar();
  const codificador = new TextEncoder();
  let aberto = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Cliente que desistiu: enfileirar depois de cancelar/fechar lançaria.
      const enviar = (evento: object) => {
        if (!aberto) return;
        try {
          controller.enqueue(codificador.encode(JSON.stringify(evento) + "\n"));
        } catch {
          aberto = false;
        }
      };

      try {
        const resultado = await responder(mensagens, { aoPasso: (passo) => enviar(linhaDoPasso(passo)), signal: controle.signal });
        enviar({ tipo: "resposta", resposta: resultado.resposta, ferramentas: resultado.ferramentas });
      } catch (erro) {
        if (!controle.signal.aborted) enviar({ tipo: "erro", erro: mensagemDoErro(erro) });
      } finally {
        sinal.removeEventListener("abort", cancelar);
        if (aberto) {
          aberto = false;
          try {
            controller.close();
          } catch {
            // Já fechado pelo cliente.
          }
        }
      }
    },
    cancel() {
      aberto = false;
      cancelar();
      sinal.removeEventListener("abort", cancelar);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function ehPapelValido(valor: unknown): valor is Mensagem["papel"] {
  return valor === "usuario" || valor === "agente";
}

/** Valida o corpo da requisição sem confiar em nada que veio do cliente. */
function validarMensagens(
  corpo: unknown,
): Array<Pick<Mensagem, "papel" | "conteudo">> | null {
  if (typeof corpo !== "object" || corpo === null || !("mensagens" in corpo)) return null;

  const { mensagens } = corpo as { mensagens: unknown };
  if (!Array.isArray(mensagens) || mensagens.length === 0 || mensagens.length > 40) return null;

  let total = 0;
  const validas: Array<Pick<Mensagem, "papel" | "conteudo">> = [];
  for (const item of mensagens) {
    if (typeof item !== "object" || item === null) return null;

    const { papel, conteudo } = item as Record<string, unknown>;
    if (!ehPapelValido(papel) || typeof conteudo !== "string" || conteudo.trim() === "" || conteudo.length > 20_000) {
      return null;
    }

    total += conteudo.length;
    if (total > 80_000) return null;
    validas.push({ papel, conteudo });
  }

  return validas;
}
