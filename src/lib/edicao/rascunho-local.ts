export type RascunhoLocal = { conteudo: string; revisaoBase: number; em: number; instancia?: string };
type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function lerRascunho(texto: string | null): RascunhoLocal | null {
  if (!texto) return null;
  try {
    const r = JSON.parse(texto);
    if (!r || typeof r.conteudo !== "string" || !Number.isSafeInteger(r.revisaoBase) || r.revisaoBase < 0 || typeof r.em !== "number" || !Number.isFinite(r.em) || r.em < 0) return null;
    return { conteudo: r.conteudo, revisaoBase: r.revisaoBase, em: r.em, ...(typeof r.instancia === "string" ? { instancia: r.instancia } : {}) };
  } catch { return null; }
}
export function decidirRascunho(r: RascunhoLocal | null, nota: { conteudo: string; revisao: number }): "nenhum" | "restaurar" | "conflito" {
  if (!r || r.conteudo === nota.conteudo) return "nenhum";
  return r.revisaoBase === nota.revisao ? "restaurar" : "conflito";
}
function armazenamentoDoNavegador(): Armazenamento | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
/** Limitação com último valor, não debounce: digitar continuamente ainda produz cópias a cada 500 ms. */
export function criarRascunhoLocal(id: string, armazenamento = armazenamentoDoNavegador(), aoFalhar?: () => void) {
  const chave = `bimo_rascunho:${id}`;
  const instancia = crypto.randomUUID();
  let lido: string | null = null;
  let pendente: RascunhoLocal | null = null;
  let ultima: RascunhoLocal | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function limpar() {
    try {
      const bruto = armazenamento?.getItem(chave) ?? null;
      if (lerRascunho(bruto)?.instancia === instancia || (bruto === lido && lido !== null)) armazenamento?.removeItem(chave);
    } catch { aoFalhar?.(); }
  }
  function ler() {
    try { lido = armazenamento?.getItem(chave) ?? null; const r = lerRascunho(lido); ultima = r; return r; } catch { aoFalhar?.(); return null; }
  }
  function descarregar() {
    clearTimeout(timer); timer = undefined;
    if (!pendente) return;
    try {
      if (!armazenamento) { aoFalhar?.(); return; }
      armazenamento.setItem(chave, JSON.stringify(pendente)); pendente = null;
    } catch { aoFalhar?.(); }
  }
  return {
    ler, limpar() { clearTimeout(timer); timer = undefined; pendente = null; ultima = null; limpar(); }, descarregar,
    guardar(conteudo: string, revisaoBase: number) { lido = null; ultima = pendente = { conteudo, revisaoBase, em: Date.now(), instancia }; timer ??= setTimeout(descarregar, 500); },
    confirmar(conteudo: string) { if (ultima?.conteudo === conteudo) { clearTimeout(timer); timer = undefined; pendente = null; ultima = null; limpar(); } },
    destruir() { descarregar(); clearTimeout(timer); },
  };
}
