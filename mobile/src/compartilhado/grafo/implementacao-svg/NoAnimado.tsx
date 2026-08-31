import { Pressable, Text } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { Circle } from "react-native-svg";
import { useTema } from "@/compartilhado/tema";
import { raioDoNo, type Posicao } from "../posicionamento";

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

// O rótulo é uma <Text> do RN, não texto do SVG: react-native-svg só entrega
// toque de forma confiável no elemento raiz, e leitor de tela lê <Text> do RN
// — não lê RNSVGText.
const LARGURA_DO_ROTULO = 96;
const ESPACO_DO_ROTULO = 6;
const FOLGA_DO_ALVO = 10;
const FOLGA_DO_ANEL = 7;

type PropsDoNo = {
  posicoes: SharedValue<Posicao[]>;
  indice: number;
  peso: number;
  selecionado: boolean;
  id: string;
};

export function NoAnimado({ posicoes, indice, peso, selecionado, id }: PropsDoNo) {
  const { cores } = useTema();

  const propsDoCirculo = useAnimatedProps<{ cx?: number; cy?: number }>(() => {
    const posicao = posicoes.value[indice];
    // Vale o mesmo de ArestaAnimada: no render em que `nos` cresceu e o efeito
    // ainda não reescreveu o shared value, este índice não existe.
    if (!posicao) return {};
    return { cx: posicao.x, cy: posicao.y };
  });

  return (
    <>
      {selecionado ? (
        <CirculoAnimado
          testID={`anel-do-no-${id}`}
          animatedProps={propsDoCirculo}
          r={raioDoNo(peso) + FOLGA_DO_ANEL}
          fill="none"
          stroke={cores.grafoAnelSelecao}
          strokeWidth={2}
        />
      ) : null}
      <CirculoAnimado
        testID={`no-${id}`}
        animatedProps={propsDoCirculo}
        r={raioDoNo(peso)}
        fill={selecionado ? cores.grafoNoSinal : cores.grafoNoPreenchimento}
        stroke={selecionado ? cores.grafoNoSinal : cores.grafoNoBorda}
        strokeWidth={1}
      />
    </>
  );
}

export function RotuloAnimado({ posicoes, indice, peso, selecionado, titulo }: Omit<PropsDoNo, "id"> & { titulo: string }) {
  const { cores, tipografia } = useTema();

  const estilo = useAnimatedStyle(() => {
    const posicao = posicoes.value[indice];
    if (!posicao) return {};
    return {
      left: posicao.x - LARGURA_DO_ROTULO / 2,
      top: posicao.y + raioDoNo(peso) + ESPACO_DO_ROTULO,
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", width: LARGURA_DO_ROTULO }, estilo]}>
      <Text
        style={{
          textAlign: "center",
          fontFamily: tipografia.rotuloSm.fontFamily,
          fontSize: tipografia.rotuloSm.fontSize,
          color: selecionado ? cores.grafoNoRotuloSelecionado : cores.grafoNoRotulo,
        }}
      >
        {titulo}
      </Text>
    </Animated.View>
  );
}

export function AlvoDoNoAnimado({ posicoes, indice, peso, id, titulo, aoTocar }: {
  posicoes: SharedValue<Posicao[]>;
  indice: number;
  peso: number;
  id: string;
  titulo: string;
  aoTocar: () => void;
}) {
  const alvo = raioDoNo(peso) + FOLGA_DO_ALVO;

  const estilo = useAnimatedStyle(() => {
    const posicao = posicoes.value[indice];
    if (!posicao) return {};
    return { left: posicao.x - alvo, top: posicao.y - alvo };
  });

  return (
    <Animated.View style={[{ position: "absolute", width: alvo * 2, height: alvo * 2 }, estilo]}>
      <Pressable
        testID={`alvo-do-no-${id}`}
        accessibilityRole="button"
        accessibilityLabel={titulo}
        onPress={aoTocar}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}
