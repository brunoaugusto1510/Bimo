import { z } from "zod";
import { exigirSessao } from "@/lib/autenticacao";
import { exigirMesmaOrigem, lerJsonComLimite, respostaDeErro } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { agendarManutencaoWiki } from "@/lib/wiki/agendar";

const esquema = z.object({ notaId: z.string().min(1).max(100), revisaoBase: z.number().int().positive(), gerenciada: z.boolean() }).strict();
/** Contrato para futura interface; retirar/retomar gerenciamento exige decisão explícita. */
export async function POST(request: Request) {
  const sessao = exigirSessao(request); if (sessao) return sessao;
  const origem = exigirMesmaOrigem(request); if (origem) return origem;
  const corpo = await lerJsonComLimite(request); if (!corpo.ok) return corpo.resposta;
  const pedido = esquema.safeParse(corpo.dados); if (!pedido.success) return respostaDeErro(400, "Informe nota, revisão e gerenciamento.");
  try {
    const repo = await obterRepositorio(); const fila = repo.wiki?.automacao;
    if (!fila) return respostaDeErro(503, "A manutenção da wiki não está habilitada.");
    const r = await fila.gerenciar(pedido.data.notaId, pedido.data.revisaoBase, pedido.data.gerenciada);
    if (r === "nao-encontrada") return respostaDeErro(404, "Síntese gerenciada não encontrada.");
    if (r === "conflito") return respostaDeErro(409, "A nota mudou. Releia antes de alterar o gerenciamento.");
    agendarManutencaoWiki();
    return Response.json({ tipo: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return respostaDeErro(500, "Não foi possível alterar o gerenciamento da síntese."); }
}
