import type { Cores } from "@/compartilhado/tema/tokens/cores";
import type { Tom } from "../fisica";

export function corDoTom(tom: Tom, cores: Cores): string {
  return {
    base: cores.grafoNoBase,
    suave: cores.grafoNoSuave,
    tenue: cores.grafoNoTenue,
    sinal: cores.grafoNoSinal,
  }[tom];
}
