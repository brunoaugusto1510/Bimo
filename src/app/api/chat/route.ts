import { NextResponse } from "next/server";
import { responder } from "@/lib/agente";
import { respostaDeDesafio, verificarCredenciais } from "@/lib/autenticacao";
import type { Mensagem } from "@/lib/types";

/**
 * Rota do chat de verdade: recebe o histórico da conversa, chama o agente
 * (que decide se e quais ferramentas usar) e devolve a resposta final.
 *
 * Roda no servidor (toda rota dentro de app/api roda lá), então é o único
 * lugar — além da rota de notas — que usa GEMINI_API_KEY/GITHUB_TOKEN.
 */
export async function POST(request: Request) {
  // O `proxy.ts` já barra isso na borda; conferir aqui também é de propósito.
  // A doc do Next 16 avisa que uma mudança de `matcher` pode descobrir uma rota
  // sem ninguém notar — e esta gasta cota do Gemini, além de ler o vault.
  const autenticacao = verificarCredenciais(request);
  if (autenticacao.tipo !== "ok") return respostaDeDesafio(autenticacao);

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { erro: "Corpo da requisição não é um JSON válido." },
      { status: 400 },
    );
  }

  const mensagens = validarMensagens(corpo);
  if (!mensagens) {
    return NextResponse.json(
      {
        erro:
          'Envie {"mensagens": [{"papel": "usuario"|"agente", "conteudo": "..."}]} ' +
          "com pelo menos uma mensagem.",
      },
      { status: 400 },
    );
  }

  try {
    const resultado = await responder(mensagens);
    return NextResponse.json(resultado);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
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
  if (!Array.isArray(mensagens) || mensagens.length === 0) return null;

  const validas: Array<Pick<Mensagem, "papel" | "conteudo">> = [];
  for (const item of mensagens) {
    if (typeof item !== "object" || item === null) return null;

    const { papel, conteudo } = item as Record<string, unknown>;
    if (!ehPapelValido(papel) || typeof conteudo !== "string" || conteudo.trim() === "") {
      return null;
    }

    validas.push({ papel, conteudo });
  }

  return validas;
}
