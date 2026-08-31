import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import { Circle, Line } from "react-native-svg";
import type { Cores } from "@/compartilhado/tema/tokens/cores";
// O tom chega por prop, e não lido do shared value: ler `.value` durante o
// render é justamente o que o modo estrito do Reanimated proíbe, e o tom não
// muda depois que o nó nasce.
import { opacidadeDaParticula, type NoAmbiente, type Particula, type Tom } from "../fisica";
import { corDoTom } from "./tomDoNo";

const CirculoAnimado = Animated.createAnimatedComponent(Circle);
const LinhaAnimada = Animated.createAnimatedComponent(Line);

const PULSACAO = 0.06;
const RAIO_DA_PARTICULA = 2.4;

// Estes três leem as posições direto do shared value que o loop de quadros
// escreve. O React só os re-renderiza quando a *lista* muda — densidade nova,
// nó que nasceu, ligações recalculadas —, nunca por movimento.
export function NoDoCampo({ campo, indice, tom, cores }: {
  campo: SharedValue<NoAmbiente[]>;
  indice: number;
  tom: Tom;
  cores: Cores;
}) {
  const props = useAnimatedProps<{ cx?: number; cy?: number; r?: number }>(() => {
    const no = campo.value[indice];
    if (!no) return {};
    return { cx: no.x, cy: no.y, r: no.raio * no.escala * (1 + Math.sin(no.fase) * PULSACAO) };
  });

  return <CirculoAnimado animatedProps={props} fill={corDoTom(tom, cores)} />;
}

export function LigacaoDoCampo({ campo, de, para, cor }: {
  campo: SharedValue<NoAmbiente[]>;
  de: number;
  para: number;
  cor: string;
}) {
  const props = useAnimatedProps<{ x1?: number; y1?: number; x2?: number; y2?: number }>(() => {
    const origem = campo.value[de];
    const destino = campo.value[para];
    if (!origem || !destino) return {};
    return { x1: origem.x, y1: origem.y, x2: destino.x, y2: destino.y };
  });

  return <LinhaAnimada animatedProps={props} stroke={cor} strokeWidth={1} />;
}

export function ParticulaDoCampo({ particulas, indice, vivas, cor }: {
  particulas: SharedValue<Particula[]>;
  indice: number;
  vivas: SharedValue<number>;
  cor: string;
}) {
  const props = useAnimatedProps<{ cx?: number; cy?: number; opacity?: number }>(() => {
    const particula = particulas.value[indice];
    // Partícula além do fim do pedaço vivo é desenhada transparente em vez de
    // desmontada: montar e desmontar por quadro devolveria o re-render que
    // este arranjo existe para evitar.
    if (!particula || indice >= vivas.value) return { opacity: 0 };

    return {
      cx: particula.deX + (particula.paraX - particula.deX) * particula.progresso,
      cy: particula.deY + (particula.paraY - particula.deY) * particula.progresso,
      opacity: opacidadeDaParticula(particula.progresso),
    };
  });

  return <CirculoAnimado animatedProps={props} r={RAIO_DA_PARTICULA} fill={cor} />;
}
