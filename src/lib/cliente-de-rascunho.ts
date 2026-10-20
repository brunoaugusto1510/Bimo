import { ErroDoCliente } from "./cliente-de-notas";
import type { PedidoDeRascunho } from "./edicao/pedido-de-rascunho";

/** Um pouco acima do tempo que o servidor dá ao Gemini: se chegou aqui, o servidor também já desistiu. */
const TEMPO_LIMITE_MS = 40_000;

/**
 * Pede ao Bimo um trecho de texto para a nota (`POST /api/bimo/rascunho`). Só devolve o texto: nada é
 * gravado nas notas; quem decide é a pessoa, ao aceitar. Cancelar pelo `sinal` rejeita com `AbortError`.
 */
export async function pedirRascunho(pedido: PedidoDeRascunho, sinal?: AbortSignal): Promise<string> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  const repassar = () => controle.abort();
  if (sinal?.aborted) controle.abort(); else sinal?.addEventListener("abort", repassar, { once: true });
  try {
    let resposta: Response;
    try {
      resposta = await fetch("/api/bimo/rascunho", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido), signal: controle.signal,
      });
    } catch (erro) {
      // Cancelar não é uma falha a mostrar; já o tempo esgotado é.
      if (sinal?.aborted) throw erro instanceof DOMException ? erro : new DOMException("Cancelado", "AbortError");
      if (controle.signal.aborted) throw new ErroDoCliente("O Bimo demorou demais. Tente de novo.");
      throw new ErroDoCliente("Não consegui falar com o servidor.");
    }
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new ErroDoCliente(typeof corpo?.erro === "string" ? corpo.erro : "Não consegui gerar o rascunho agora. Tente de novo.", resposta.status);
    if (typeof corpo?.texto !== "string") throw new ErroDoCliente("Não consegui gerar o rascunho agora. Tente de novo.", resposta.status);
    return corpo.texto;
  } finally {
    clearTimeout(timer);
    sinal?.removeEventListener("abort", repassar);
  }
}
