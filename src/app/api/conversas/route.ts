import { exigirSessao } from "@/lib/autenticacao";
import { SEM_CACHE, tratarErroDeConversas } from "@/lib/conversas/http";
import { obterRepositorioDeConversas } from "@/lib/conversas";

/** O histórico: as conversas mais recentes primeiro, sem as mensagens. */
export async function GET(request: Request) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  try {
    const repositorio = await obterRepositorioDeConversas();
    return Response.json({ conversas: await repositorio.listar() }, { headers: SEM_CACHE });
  } catch (erro) {
    return tratarErroDeConversas(erro, "GET /api/conversas");
  }
}
