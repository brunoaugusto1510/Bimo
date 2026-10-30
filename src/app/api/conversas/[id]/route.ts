import { exigirSessao } from "@/lib/autenticacao";
import { esquemaDeAcrescentar, esquemaDeIdDeConversa, SEM_CACHE, tratarErroDeConversas } from "@/lib/conversas/http";
import { obterRepositorioDeConversas } from "@/lib/conversas";
import { exigirMesmaOrigem, lerJsonComLimite, respostaDeErro } from "@/lib/http-de-notas";

type Contexto = { params: Promise<{ id: string }> };

/**
 * Acrescenta mensagens ao fim da conversa, criando-a se ainda não existir. O id de cada
 * mensagem vem do chat: reenviar o mesmo pedido (a resposta se perdeu) não duplica nada.
 */
export async function POST(request: Request, { params }: Contexto) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;
  const outraOrigem = exigirMesmaOrigem(request);
  if (outraOrigem) return outraOrigem;

  const id = esquemaDeIdDeConversa.safeParse((await params).id);
  if (!id.success) return respostaDeErro(400, id.error.issues[0].message);

  const corpo = await lerJsonComLimite(request);
  if (!corpo.ok) return corpo.resposta;

  const validado = esquemaDeAcrescentar.safeParse(corpo.dados);
  if (!validado.success) return respostaDeErro(400, "Envie de 1 a 10 mensagens válidas, com id, papel e conteúdo.");

  try {
    const repositorio = await obterRepositorioDeConversas();
    return Response.json({ conversa: await repositorio.acrescentar(id.data, validado.data.mensagens) });
  } catch (erro) {
    return tratarErroDeConversas(erro, "POST /api/conversas/[id]");
  }
}

/** A conversa com as mensagens mais recentes, para reabri-la no chat. */
export async function GET(request: Request, { params }: Contexto) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  const id = esquemaDeIdDeConversa.safeParse((await params).id);
  if (!id.success) return respostaDeErro(400, id.error.issues[0].message);

  try {
    const conversa = await (await obterRepositorioDeConversas()).obter(id.data);
    if (!conversa) return respostaDeErro(404, "Conversa não encontrada.");
    return Response.json(conversa, { headers: SEM_CACHE });
  } catch (erro) {
    return tratarErroDeConversas(erro, "GET /api/conversas/[id]");
  }
}

/** Apaga a conversa e as mensagens. As notas que o agente criou ou editou nela ficam onde estão. */
export async function DELETE(request: Request, { params }: Contexto) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;
  const outraOrigem = exigirMesmaOrigem(request);
  if (outraOrigem) return outraOrigem;

  const id = esquemaDeIdDeConversa.safeParse((await params).id);
  if (!id.success) return respostaDeErro(400, id.error.issues[0].message);

  try {
    const apagada = await (await obterRepositorioDeConversas()).excluir(id.data);
    if (!apagada) return respostaDeErro(404, "Conversa não encontrada.");
    return new Response(null, { status: 204 });
  } catch (erro) {
    return tratarErroDeConversas(erro, "DELETE /api/conversas/[id]");
  }
}
