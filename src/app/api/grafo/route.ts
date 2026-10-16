import { exigirSessao } from "@/lib/autenticacao";
import { tratarErroDeRepositorio } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { obterDadosDaPagina } from "@/lib/servico-de-notas";

/**
 * O grafo atual, para quem precisa atualizá-lo sem recarregar a página (a aba
 * Gráfico depois de editar). O aviso de listagem incompleta, se houver, vai junto.
 */
export async function GET(request: Request) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  try {
    const repositorio = await obterRepositorio();
    const { grafo, aviso } = await obterDadosDaPagina(repositorio);
    return Response.json({ ...grafo, aviso });
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "GET /api/grafo");
  }
}
