import { exigirSessao } from "@/lib/autenticacao";
import { exigirMesmaOrigem, respostaDeErro } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { descreverErro } from "@/lib/registro-de-erros";
import { processarWiki } from "@/lib/wiki/automacao";
import { gerarConhecimentoWiki } from "@/lib/wiki/gerador";
import { automacaoWikiHabilitada, executorWikiAutorizado, tetoDiarioWiki } from "@/lib/wiki/configuracao";

export const maxDuration = 60;
export async function POST(request: Request) {
  const semSessao = exigirSessao(request);
  const executor = executorWikiAutorizado(request);
  if (!executor) {
    if (semSessao) return semSessao;
    const origem = exigirMesmaOrigem(request); if (origem) return origem;
  }
  if (!automacaoWikiHabilitada() || !process.env.OPENAI_API_KEY?.trim()) return respostaDeErro(503, "A manutenção da wiki não está habilitada.");
  try {
    const repo = await obterRepositorio();
    if (new URL(request.url).searchParams.get("acao") === "retomar") await repo.wiki?.automacao?.retomar();
    const resultado = await processarWiki(repo, gerarConhecimentoWiki, { tetoDiario: tetoDiarioWiki(), sinal: request.signal });
    return Response.json({ ...resultado, cobertura: await repo.wiki?.automacao?.cobertura() }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error("[wiki] Falha na rodada de manutenção.", { erro: descreverErro(erro) });
    return respostaDeErro(500, "Não foi possível executar a manutenção da wiki.");
  }
}
