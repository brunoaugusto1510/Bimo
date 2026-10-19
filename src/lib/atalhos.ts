/**
 * Atalhos de teclado como texto (`"mod+o"`, `"alt+n"`), comparados com o
 * evento. `mod` é Ctrl no Windows e no Linux e Cmd no Mac.
 *
 * Nem todo atalho pode ser interceptado: o navegador reserva Ctrl+N, Ctrl+T,
 * Ctrl+W e Ctrl+Tab e a página nunca os recebe. Por isso "nova nota" é Alt+N.
 */

/** O que importa do `KeyboardEvent` — assim dá para testar sem o DOM. */
export type EventoDeTecla = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "isComposing">;

/** `n` -> `KeyN`, `1` -> `Digit1`; as demais teclas (Enter, Escape…) não têm tecla física de letra. */
function teclaFisicaDe(tecla: string): string | null {
  if (/^[a-z]$/.test(tecla)) return `Key${tecla.toUpperCase()}`;
  if (/^\d$/.test(tecla)) return `Digit${tecla}`;
  return null;
}

export function combinaAtalho(evento: EventoDeTecla, atalho: string): boolean {
  // O Chrome dispara `keydown` sem `key` ao preencher um campo automaticamente.
  if (evento.isComposing || typeof evento.key !== "string" || evento.key === "Dead") return false;

  const partes = atalho.toLowerCase().split("+");
  const tecla = partes[partes.length - 1];
  const modificadores = new Set(partes.slice(0, -1));

  // `mod` é Ctrl ou Cmd, mas só um dos dois: Ctrl+Cmd+O não é Ctrl+O.
  const mod = evento.ctrlKey !== evento.metaKey;

  // No Mac, Option+N produz "˜" em vez de "n": com Alt, vale também a tecla física.
  const teclaCasa =
    evento.key.toLowerCase() === tecla || (evento.altKey && teclaFisicaDe(tecla) !== null && evento.code === teclaFisicaDe(tecla));

  return (
    teclaCasa &&
    mod === modificadores.has("mod") &&
    evento.altKey === modificadores.has("alt") &&
    evento.shiftKey === modificadores.has("shift")
  );
}
