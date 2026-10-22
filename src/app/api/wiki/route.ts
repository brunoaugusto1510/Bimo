import { exigirSessao } from "@/lib/autenticacao";
import { exigirMesmaOrigem, lerJsonComLimite, respostaDeErro } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { criarLimitadorDeUso } from "@/lib/limite-de-uso";
import { compilarWiki, esquemaDoPedidoWiki, estadoDaPagina, exigirWiki, obterIndiceWiki } from "@/lib/wiki/servico";
import { gerarSinteseWiki } from "@/lib/wiki/gerador";
import { ErroWiki } from "@/lib/wiki/tipos";
import { automacaoWikiHabilitada } from "@/lib/wiki/configuracao";

// Melhor esforço por instância; a compilação é sempre uma ação explícita.
const limite = criarLimitadorDeUso({ maximo: 5, janelaMs: 60_000 });
const json = (valor: unknown, status = 200) => Response.json(valor, { status, headers: { "Cache-Control": "no-store" } });
function falha(erro: unknown) {
  if (erro instanceof ErroWiki) return respostaDeErro(erro.status, erro.message);
  // O objeto do erro pode carregar texto das notas ou detalhes da conexão.
  return respostaDeErro(500, "Não consegui processar a wiki agora. Tente novamente.");
}

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
    const paginas = await obterIndiceWiki(repo); const ids = new Set(paginas.map((p) => p.id));
    return json({ paginas, notas: (await repo.listarResumos()).filter((n) => !ids.has(n.id)), disponivel: repo.capacidades.escrita });
  } catch (erro) { return falha(erro); }
}

export async function POST(request: Request) {
  const recusa = exigirSessao(request); if (recusa) return recusa;
  const origem = exigirMesmaOrigem(request); if (origem) return origem;
  if (automacaoWikiHabilitada()) return respostaDeErro(409, "A Wiki Viva é mantida automaticamente a partir das notas salvas.");
  const corpo = await lerJsonComLimite(request); if (!corpo.ok) return corpo.resposta;
  const validado = esquemaDoPedidoWiki.safeParse(corpo.dados);
  if (!validado.success) return respostaDeErro(400, "Informe título, de uma a dez notas e, ao atualizar, a revisão da página.");
  if (!process.env.OPENAI_API_KEY?.trim()) return respostaDeErro(503, "A geração da wiki está indisponível neste ambiente.");
  const tentativa = limite.tentar("wiki");
  if (!tentativa.permitido) return Response.json({ erro: "Muitas compilações seguidas. Aguarde um minuto." }, { status: 429, headers: { "Retry-After": String(tentativa.esperarSegundos) } });
  const controle = new AbortController();
  const cancelar = () => controle.abort();
  request.signal.addEventListener("abort", cancelar, { once: true });
  if (request.signal.aborted) cancelar();
  const temporizador = setTimeout(cancelar, 45_000);
  try {
    const repo = await obterRepositorio();
    if (!repo.capacidades.escrita) throw new ErroWiki("As notas estão em modo somente leitura.", 403);
    const sinal = controle.signal;
    const resultado = await compilarWiki(repo, validado.data, async (contexto) => {
      const proposta = await gerarSinteseWiki(contexto, sinal); sinal.throwIfAborted(); return proposta;
    });
    return json(resultado, resultado.tipo === "ok" && !validado.data.paginaId ? 201 : 200);
  } catch (erro) { return falha(erro); }
  finally { clearTimeout(temporizador); request.signal.removeEventListener("abort", cancelar); }
}
