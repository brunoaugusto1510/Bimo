import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";
import { processarWiki } from "./automacao";
import type { GeradorAutomaticoWiki } from "./automacao-tipos";

type OpcoesDoLote = { tetoDiario: number; sinal?: AbortSignal; maxRodadas?: number };
type ParadaDoLote = "rodadas" | "tempo" | "cancelado" | "ocioso" | "orcamento" | "adiado" | "desligado";
type ResultadoDaRodada = Awaited<ReturnType<typeof processarWiki>>;

// A rota dispõe de 300 s. O lote para de abrir rodadas aos 180 s e sinaliza aos 240 s,
// deixando margem para publicar um resultado já pago e devolver a cobertura.
const PRAZO_DO_LOTE_MS = 240_000;
const MARGEM_DA_RODADA_MS = 60_000;

/** Cada rodada mantém suas transações, posse e reserva de tokens; interromper não perde progresso. */
export async function processarLoteWiki(repo: RepositorioDeNotas, gerar: GeradorAutomaticoWiki, opcoes: OpcoesDoLote) {
  const maxRodadas = opcoes.maxRodadas ?? 25;
  if (!Number.isSafeInteger(maxRodadas) || maxRodadas < 1 || maxRodadas > 25) throw new Error("Limite de rodadas inválido.");
  const inicio = Date.now();
  const prazo = AbortSignal.timeout(PRAZO_DO_LOTE_MS);
  const sinal = opcoes.sinal ? AbortSignal.any([opcoes.sinal, prazo]) : prazo;
  let ultima: ResultadoDaRodada = { tipo: "ocioso" };
  const lote = { rodadas: 0, processados: 0, publicadas: 0, descartadas: 0, parada: "rodadas" as ParadaDoLote };
  while (lote.rodadas < maxRodadas) {
    if (opcoes.sinal?.aborted) { lote.parada = "cancelado"; break; }
    if (prazo.aborted || Date.now() - inicio >= PRAZO_DO_LOTE_MS - MARGEM_DA_RODADA_MS) { lote.parada = "tempo"; break; }
    ultima = await processarWiki(repo, gerar, { tetoDiario: opcoes.tetoDiario, sinal });
    lote.rodadas++;
    if (ultima.tipo !== "processado") { lote.parada = ultima.tipo; break; }
    lote.processados++;
    lote.publicadas += ultima.publicadas;
    lote.descartadas += ultima.descartadas;
  }
  return { ...ultima, lote };
}
