/**
 * Tema claro/escuro do app.
 *
 * Quem decide as cores é o CSS, lendo o atributo `data-tema` do `<html>`
 * (`claro` ou `escuro`; ver `globals.css`). Este módulo cuida do que vem
 * antes: de onde sai esse valor. Há três preferências — `sistema` (segue o
 * tema do computador), `claro` e `escuro` — guardadas no `localStorage` e
 * resolvidas para um dos dois temas reais.
 *
 * O atributo é sempre escrito por JS, mesmo no automático: assim o CSS tem um
 * bloco escuro só (e não um `@media` mais um seletor repetidos), e o canvas do
 * grafo consegue ouvir a troca num lugar só.
 */

export type PreferenciaDeTema = "sistema" | "claro" | "escuro";
export type TemaAplicado = "claro" | "escuro";

export const CHAVE_DO_TEMA = "bimo_tema";
export const ATRIBUTO_DO_TEMA = "data-tema";
/** Disparado na `window` quando a preferência muda nesta aba (o evento `storage` só cobre as outras). */
export const EVENTO_DE_TEMA = "bimo:tema";

export const CONSULTA_DO_SISTEMA_ESCURO = "(prefers-color-scheme: dark)";

const CICLO: readonly PreferenciaDeTema[] = ["sistema", "claro", "escuro"];

function ehPreferencia(valor: unknown): valor is PreferenciaDeTema {
  return CICLO.includes(valor as PreferenciaDeTema);
}

export function resolverTema(preferencia: PreferenciaDeTema, sistemaEscuro: boolean): TemaAplicado {
  if (preferencia === "sistema") return sistemaEscuro ? "escuro" : "claro";
  return preferencia;
}

/** Ordem do botão: automático → claro → escuro → automático. */
export function proximaPreferencia(atual: PreferenciaDeTema): PreferenciaDeTema {
  return CICLO[(CICLO.indexOf(atual) + 1) % CICLO.length];
}

/**
 * Reserva para quando o armazenamento está bloqueado (janela privada, cookies
 * desligados): o botão segue funcionando durante a sessão, só não lembra depois.
 */
let preferenciaEmMemoria: PreferenciaDeTema | null = null;

export function lerPreferenciaSalva(): PreferenciaDeTema {
  try {
    const salva = localStorage.getItem(CHAVE_DO_TEMA);
    return ehPreferencia(salva) ? salva : "sistema";
  } catch {
    return preferenciaEmMemoria ?? "sistema";
  }
}

export function salvarPreferencia(preferencia: PreferenciaDeTema): void {
  preferenciaEmMemoria = preferencia;
  try {
    localStorage.setItem(CHAVE_DO_TEMA, preferencia);
  } catch {
    // Sem armazenamento: vale só nesta sessão (ver `preferenciaEmMemoria`).
  }
  window.dispatchEvent(new Event(EVENTO_DE_TEMA));
}

export function sistemaPedeEscuro(): boolean {
  return window.matchMedia?.(CONSULTA_DO_SISTEMA_ESCURO).matches ?? false;
}

/** Escreve o tema no `<html>` e devolve qual foi. */
export function aplicarTema(preferencia: PreferenciaDeTema): TemaAplicado {
  const tema = resolverTema(preferencia, sistemaPedeEscuro());
  document.documentElement.setAttribute(ATRIBUTO_DO_TEMA, tema);
  return tema;
}

/**
 * Roda no `<head>`, antes da primeira pintura: sem isso a página nasceria clara
 * e piscaria para escura quando o React hidratasse. É o mesmo cálculo de
 * `aplicarTema`, em JS puro e autônomo (não pode importar nada) — o teste
 * garante que os dois concordam. Se algo falhar, o atributo fica de fora e o
 * CSS cai no tema claro.
 */
export const SCRIPT_DO_TEMA = `(function(){try{var p=localStorage.getItem("${CHAVE_DO_TEMA}");var e=p==="escuro"||(p!=="claro"&&!!window.matchMedia&&window.matchMedia("${CONSULTA_DO_SISTEMA_ESCURO}").matches);document.documentElement.setAttribute("${ATRIBUTO_DO_TEMA}",e?"escuro":"claro")}catch(_){}})()`;
