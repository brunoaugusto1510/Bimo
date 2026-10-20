export type PosicaoDoCursor = { topo: number; esquerda: number; altura: number };

const PROPRIEDADES_DO_FLUXO = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
  "textTransform", "textIndent", "wordSpacing", "tabSize",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "boxSizing", "width",
] as const;

/** Coordenadas relativas à caixa do campo, descontando sua rolagem. */
export function posicaoDoCursor(campo: HTMLTextAreaElement, indice: number): PosicaoDoCursor {
  const espelho = document.createElement("div");
  try {
    const estilo = getComputedStyle(campo);
    for (const propriedade of PROPRIEDADES_DO_FLUXO) espelho.style[propriedade] = estilo[propriedade];
    espelho.style.position = "absolute";
    espelho.style.left = "-10000px";
    espelho.style.visibility = "hidden";
    espelho.style.whiteSpace = "pre-wrap";
    espelho.style.overflowWrap = "break-word";

    const limitado = Math.max(0, Math.min(indice, campo.value.length));
    espelho.textContent = campo.value.slice(0, limitado);
    const marcador = document.createElement("span");
    marcador.textContent = "\u200b";
    espelho.append(marcador);
    document.body.append(espelho);

    return {
      topo: marcador.offsetTop - campo.scrollTop,
      esquerda: marcador.offsetLeft - campo.scrollLeft,
      altura: marcador.offsetHeight || parseFloat(estilo.lineHeight) || 1.2 * parseFloat(estilo.fontSize),
    };
  } finally {
    espelho.remove();
  }
}
