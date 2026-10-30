import { exigirSessao } from "@/lib/autenticacao";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { tratarErroDeRepositorio } from "@/lib/http-de-notas";
export async function GET(request: Request) {
  const semSessao = exigirSessao(request); if (semSessao) return semSessao;
  try {
    const repo = await obterRepositorio();
    return Response.json({ notas: await repo.listarLixeira() }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) { return tratarErroDeRepositorio(erro, "GET /api/notas/lixeira"); }
}
