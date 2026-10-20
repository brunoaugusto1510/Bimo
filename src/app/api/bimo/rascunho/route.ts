import { exigirSessao } from "@/lib/autenticacao";
import { exigirMesmaOrigem, lerJsonComLimite, respostaDeErro } from "@/lib/http-de-notas";
import { criarLimitadorDeUso } from "@/lib/limite-de-uso";
import { gerarRascunho } from "@/lib/rascunho-do-bimo";
import { mensagemDoPrimeiroErro } from "@/lib/validacao-de-notas";
import { esquemaDeRascunho } from "@/lib/validacao-do-rascunho";

const limitador = criarLimitadorDeUso({ maximo: 20, janelaMs: 60_000 });
const LIMITE_DO_CORPO = 65_536;

/** Aplica o teto menor sem alterar o contrato compartilhado das rotas de notas. */
async function lerPedido(request: Request) {
  const grandeDemais = () => ({ ok: false as const, resposta: respostaDeErro(413, "A requisição é grande demais (o limite é 64 KB).") });
  const tipo = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") return lerJsonComLimite(request);
  if (Number(request.headers.get("content-length")) > LIMITE_DO_CORPO) return grandeDemais();
  const leitor = request.body?.getReader();
  if (!leitor) return lerJsonComLimite(request);
  const pedacos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > LIMITE_DO_CORPO) {
        await leitor.cancel();
        return grandeDemais();
      }
      pedacos.push(value);
    }
  } catch {
    return { ok: false as const, resposta: respostaDeErro(400, "Não foi possível ler o corpo da requisição.") };
  } finally {
    leitor.releaseLock();
  }
  return lerJsonComLimite(new Request(request.url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: new TextDecoder().decode(Buffer.concat(pedacos)),
  }));
}

export async function POST(request: Request) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;
  const outraOrigem = exigirMesmaOrigem(request);
  if (outraOrigem) return outraOrigem;
  const corpo = await lerPedido(request);
  if (!corpo.ok) return corpo.resposta;
  const validado = esquemaDeRascunho.safeParse(corpo.dados);
  if (!validado.success) return respostaDeErro(400, mensagemDoPrimeiroErro(validado.error));

  // O app tem um único usuário e o custo é do Gemini dele: um limite só, que mudar o `x-forwarded-for` não zera.
  const limite = limitador.tentar("usuario");
  if (!limite.permitido) {
    return Response.json({ erro: "Muitos pedidos seguidos. Espere alguns segundos." }, {
      status: 429, headers: { "Retry-After": String(limite.esperarSegundos) },
    });
  }
  if (!process.env.GEMINI_API_KEY) return respostaDeErro(503, "O Bimo está indisponível no momento. Tente mais tarde.");
  try {
    const texto = await gerarRascunho(validado.data, { sinal: request.signal });
    return Response.json({ texto }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Não incluir erros do SDK: podem carregar o conteúdo da nota ou credenciais.
    console.error("[POST /api/bimo/rascunho] Falha ao gerar o rascunho.");
    return respostaDeErro(500, "Não consegui gerar o rascunho agora. Tente de novo.");
  }
}
