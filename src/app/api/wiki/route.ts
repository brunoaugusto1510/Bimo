import { exigirSessao } from "@/lib/autenticacao";
import { respostaDeErro } from "@/lib/http-de-notas";
import { descreverErro } from "@/lib/registro-de-erros";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { estadoDaPagina, exigirWiki, obterIndiceWiki } from "@/lib/wiki/servico";
import { ErroWiki } from "@/lib/wiki/tipos";

const json = (valor: unknown, status = 200) => Response.json(valor, { status, headers: { "Cache-Control": "no-store" } });
function falha(erro: unknown) {
  if (erro instanceof ErroWiki) return respostaDeErro(erro.status, erro.message);
  // O objeto do erro pode carregar texto das notas ou detalhes da conexão: o log leva só a categoria.
  console.error("[wiki] Falha ao consultar a wiki.", { erro: descreverErro(erro) });
  return respostaDeErro(500, "Não consegui consultar a wiki agora. Tente novamente.");
}

/**
 * Leitura das sínteses: sem `id`, o índice; com `id`, a síntese, seu estado e as evidências das origens acessíveis.
 * A manutenção é automática (fila + executor); não há rota para compilar à mão.
 */
export async function GET(request: Request) {
  const recusa = exigirSessao(request); if (recusa) return recusa;
  try {
    const repo = await obterRepositorio(); const wiki = exigirWiki(repo);
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const evidencias = await wiki.obter(id); const nota = await repo.obterNota(id);
      if (!evidencias || !nota) return respostaDeErro(404, "Página não encontrada.");
      const permitidas = new Set<string>();
      for (const fonte of evidencias.fontes) if (await repo.obterNota(fonte.id)) permitidas.add(fonte.id);
      return json({ nota, estado: await estadoDaPagina(repo, evidencias), evidencias: { ...evidencias,
        fontes: evidencias.fontes.filter((f) => permitidas.has(f.id)),
        afirmacoes: evidencias.afirmacoes.map((a) => ({ ...a, evidencias: a.evidencias.filter((e) => permitidas.has(e.fonteId)) })),
      } });
    }
    return json({ paginas: await obterIndiceWiki(repo) });
  } catch (erro) { return falha(erro); }
}
