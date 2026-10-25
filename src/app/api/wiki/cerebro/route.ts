import { exigirSessao } from "@/lib/autenticacao";
import { respostaDeErro } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { tetoDiarioWiki } from "@/lib/wiki/configuracao";
import { obterCerebroWiki } from "@/lib/wiki/observabilidade";
import { ErroWiki } from "@/lib/wiki/tipos";

export async function GET(request: Request) {
  const sessao = exigirSessao(request); if (sessao) return sessao;
  try {
    const dados = await obterCerebroWiki(await obterRepositorio(), tetoDiarioWiki());
    // O cérebro é um resumo: o detalhe de uma síntese e suas citações é lido em GET /api/wiki?id=…
    const neuronios = dados.neuronios.map(({ afirmacoes, fontes, estrutura, ...nota }) => ({ ...nota,
      afirmacoes: afirmacoes.length, fontes: fontes.length, ligacoes: estrutura.ligacoes.length,
      perguntas: estrutura.lacunas.length, divergencias: estrutura.divergencias?.length ?? 0 }));
    return Response.json({ ...dados, neuronios }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) { return respostaDeErro(erro instanceof ErroWiki ? erro.status : 500, "Não foi possível consultar o cérebro."); }
}
