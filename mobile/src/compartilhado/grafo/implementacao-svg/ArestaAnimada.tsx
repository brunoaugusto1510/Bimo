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

  // O tipo é explícito porque o primeiro `return` é o objeto vazio da guarda,
  // e sem anotação o TypeScript infere as quatro props como `undefined`.
  const props = useAnimatedProps<{ x1?: number; y1?: number; x2?: number; y2?: number }>(() => {
    const origem = posicoes.value[de];
    const destino = posicoes.value[para];
    // As posições vêm de um shared value que só é reescrito num efeito, ou
    // seja, um render depois de `nos` mudar. No render entre os dois, o array
    // ainda tem o tamanho da lista anterior e estes índices não existem.
    if (!origem || !destino) return {};
    return { x1: origem.x, y1: origem.y, x2: destino.x, y2: destino.y };
  });

  return <LinhaAnimada animatedProps={props} stroke={cores.grafoLigacaoNomeada} strokeWidth={1} />;
}
