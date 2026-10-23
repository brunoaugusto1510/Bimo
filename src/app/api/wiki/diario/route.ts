import { z } from "zod";
import { exigirSessao } from "@/lib/autenticacao";
import { respostaDeErro } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";

const esquema = z.object({ inicio: z.iso.datetime({ offset: true }), fim: z.iso.datetime({ offset: true }), limite: z.coerce.number().int().min(1).max(100),
  antesEm: z.iso.datetime({ offset: true }).optional(), antesId: z.uuid().optional() }).refine((p) =>
  Date.parse(p.inicio) < Date.parse(p.fim) && Date.parse(p.fim) - Date.parse(p.inicio) <= 366 * 86_400_000 && Boolean(p.antesEm) === Boolean(p.antesId));

export async function GET(request: Request) {
  const sessao = exigirSessao(request); if (sessao) return sessao;
  const busca = new URL(request.url).searchParams; const agora = new Date();
  const pedido = esquema.safeParse({ inicio: busca.get("inicio") ?? new Date(agora.getTime() - 7 * 86_400_000).toISOString(),
    fim: busca.get("fim") ?? agora.toISOString(), limite: busca.get("limite") ?? 50,
    antesEm: busca.get("antesEm") ?? undefined, antesId: busca.get("antesId") ?? undefined });
  if (!pedido.success) return respostaDeErro(400, "Informe período de até um ano e cursor válidos.");
  try {
    const fila = (await obterRepositorio()).wiki?.automacao;
    if (!fila) return respostaDeErro(503, "A manutenção da wiki não está habilitada.");
    const { inicio, fim, limite, antesEm, antesId } = pedido.data;
    const eventos = await fila.diario({ inicio, fim, limite: limite + 1, ...(antesEm && antesId ? { antes: { criadoEm: antesEm, id: antesId } } : {}) });
    const pagina = eventos.slice(0, limite); const ultimo = pagina.at(-1);
    return Response.json({ eventos: pagina, proximo: eventos.length > limite && ultimo ? { criadoEm: ultimo.criadoEm, id: ultimo.id } : null },
      { headers: { "Cache-Control": "no-store" } });
  } catch { return respostaDeErro(500, "Não foi possível consultar o diário."); }
}
