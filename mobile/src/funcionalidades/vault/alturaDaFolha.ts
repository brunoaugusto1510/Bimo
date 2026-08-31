// A altura da folha vem de `onLayout`, então chega fracionária. Um pixel de
// folga evita que 100.4 conte como "o usuário já abriu a bandeja" e o toque
// na alça recolha em vez de abrir.
const TOLERANCIA = 1;

// As três levam `"worklet"` porque o gesto de arrasto da alça as chama na UI
// thread. Fora do runtime do Reanimated a diretiva é inerte — sob o Jest
// continuam funções comuns.
export function proximaAltura(atual: number, delta: number, minima: number, maxima: number): number {
  "worklet";
  return Math.min(maxima, Math.max(minima, atual + delta));
}

export function alturaMedia(minima: number, maxima: number): number {
  "worklet";
  return (minima + maxima) / 2;
}

export function alternarAltura(atual: number, minima: number, maxima: number): number {
  "worklet";
  return atual > minima + TOLERANCIA ? minima : alturaMedia(minima, maxima);
}
