/**
 * Roda antes de cada arquivo de teste.
 */
import "@testing-library/jest-dom/vitest";

// jsdom não implementa scrollIntoView (nem layout de verdade). Sem isso,
// qualquer componente que chame `elemento.scrollIntoView(...)` — como o
// autoscroll do Chat — derruba o teste com "not a function".
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
