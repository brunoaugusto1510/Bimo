/**
 * Atalhos de teclado como texto (`"mod+o"`, `"alt+n"`), comparados com o
 * evento. `mod` é Ctrl no Windows e no Linux e Cmd no Mac.
 *
 * Nem todo atalho pode ser interceptado: o navegador reserva Ctrl+N, Ctrl+T,
 * Ctrl+W e Ctrl+Tab e a página nunca os recebe. Por isso "nova nota" é Alt+N.
 */

/** O que importa do `KeyboardEvent` — assim dá para testar sem o DOM. */
export type EventoDeTecla = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing">;

export function combinaAtalho(evento: EventoDeTecla, atalho: string): boolean {
  if (evento.isComposing) return false;

  const partes = atalho.toLowerCase().split("+");
  const tecla = partes[partes.length - 1];
  const modificadores = new Set(partes.slice(0, -1));

  // `mod` é Ctrl ou Cmd, mas só um dos dois: Ctrl+Cmd+O não é Ctrl+O.
  const mod = evento.ctrlKey !== evento.metaKey;

  return (
    evento.key.toLowerCase() === tecla &&
    mod === modificadores.has("mod") &&
    evento.altKey === modificadores.has("alt") &&
    evento.shiftKey === modificadores.has("shift")
  );
}
