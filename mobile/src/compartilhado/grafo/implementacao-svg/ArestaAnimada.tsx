import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import { Line } from "react-native-svg";
import { useTema } from "@/compartilhado/tema";
import type { Posicao } from "../posicionamento";

const LinhaAnimada = Animated.createAnimatedComponent(Line);

export function ArestaAnimada({ posicoes, de, para }: {
  posicoes: SharedValue<Posicao[]>;
  de: number;
  para: number;
}) {
  const { cores } = useTema();

  const props = useAnimatedProps(() => {
    const origem = posicoes.value[de];
    const destino = posicoes.value[para];
    return { x1: origem.x, y1: origem.y, x2: destino.x, y2: destino.y };
  });

  return <LinhaAnimada animatedProps={props} stroke={cores.grafoLigacaoNomeada} strokeWidth={1} />;
}
