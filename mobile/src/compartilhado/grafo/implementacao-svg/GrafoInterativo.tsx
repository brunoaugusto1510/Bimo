import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Circle, G, Line } from "react-native-svg";
import { useTema } from "@/compartilhado/tema";
import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import { deveRotular } from "../fisica";
import { posicionarNo, raioDoNo } from "../posicionamento";

const ZOOM_MINIMO = 0.6;
const ZOOM_MAXIMO = 2.4;
// O rótulo é uma <Text> do RN, não texto do SVG: react-native-svg só entrega
// toque de forma confiável no elemento raiz (o mesmo motivo dos alvos de
// toque abaixo), e uma <Text> nativa fica sobreposta ao <Svg> como um rótulo
// centralizado sob o nó. Bônus: leitor de tela lê <Text> do RN; não lê
// RNSVGText.
const LARGURA_DO_ROTULO = 96;
const ESPACO_DO_ROTULO = 6;

type Props = {
  nos: NoDoGrafo[];
  arestas: Aresta[];
  noSelecionado: string | null;
  aoSelecionarNo: (id: string | null) => void;
};

export function GrafoInterativo({ nos, arestas, noSelecionado, aoSelecionarNo }: Props) {
  const { cores, tipografia } = useTema();
  const { width: largura, height: altura } = useWindowDimensions();

  const deslocamentoX = useSharedValue(0);
  const deslocamentoY = useSharedValue(0);
  const zoom = useSharedValue(1);

  const arrastar = Gesture.Pan().onChange((evento) => {
    deslocamentoX.value += evento.changeX;
    deslocamentoY.value += evento.changeY;
  });

  const pincar = Gesture.Pinch().onChange((evento) => {
    zoom.value = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, zoom.value * evento.scaleChange));
  });

  const gestos = Gesture.Simultaneous(arrastar, pincar);

  const estiloDaCamada = useAnimatedStyle(() => ({
    transform: [{ translateX: deslocamentoX.value }, { translateY: deslocamentoY.value }, { scale: zoom.value }],
  }));

  const posicoes = useMemo(
    () => new Map(nos.map((no) => [no.id, posicionarNo(no, largura, altura)])),
    [nos, largura, altura],
  );

  return (
    <View testID="grafo-interativo" style={StyleSheet.absoluteFill}>
      <GestureDetector gesture={gestos}>
        {/*
          `pointerEvents="box-none"` nesta camada e no `<Svg>` é o que faz o
          `fundo-do-grafo` (montado logo abaixo, dentro da mesma subárvore
          transformada) ser alcançável num aparelho real. Sem isso, esta
          `Animated.View` de tela cheia — e o `<Svg>` de tela cheia dentro
          dela — seriam a view mais à frente sob qualquer toque que não
          caísse num nó, e ficariam com o toque mesmo sem fazer nada com
          ele: nenhum irmão atrás (nem descendente que só apareça depois no
          JSX) receberia a chance. "box-none" torna as duas transparentes ao
          toque, deixando o toque cair nos descendentes reais — o fundo (se
          nada de mais à frente o cobrir) ou um alvo de nó (que cobre uma
          área pequena por cima do fundo).
        */}
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, estiloDaCamada]}>
          <Pressable testID="fundo-do-grafo" onPress={() => aoSelecionarNo(null)} style={StyleSheet.absoluteFill} />

          <Svg pointerEvents="box-none" width={largura} height={altura}>
            {arestas.map((aresta) => {
              const de = posicoes.get(aresta.de);
              const para = posicoes.get(aresta.para);
              if (!de || !para) return null;
              return (
                <Line
                  key={`${aresta.de}-${aresta.para}`}
                  x1={de.x}
                  y1={de.y}
                  x2={para.x}
                  y2={para.y}
                  stroke={cores.grafoLigacaoNomeada}
                  strokeWidth={1}
                />
              );
            })}

            {nos.map((no) => {
              const posicao = posicoes.get(no.id);
              if (!posicao) return null;
              const selecionado = no.id === noSelecionado;

              return (
                <G key={no.id}>
                  {selecionado ? (
                    <Circle
                      cx={posicao.x}
                      cy={posicao.y}
                      r={raioDoNo(no.peso) + 7}
                      fill="none"
                      stroke={cores.grafoAnelSelecao}
                      strokeWidth={2}
                    />
                  ) : null}
                  <Circle
                    cx={posicao.x}
                    cy={posicao.y}
                    r={raioDoNo(no.peso)}
                    fill={selecionado ? cores.grafoNoSinal : cores.grafoNoPreenchimento}
                    stroke={selecionado ? cores.grafoNoSinal : cores.grafoNoBorda}
                    strokeWidth={1}
                  />
                </G>
              );
            })}
          </Svg>

          {nos.map((no) => {
            const posicao = posicoes.get(no.id);
            if (!posicao) return null;
            const selecionado = no.id === noSelecionado;
            if (!deveRotular(no.peso, selecionado)) return null;

            return (
              <Text
                key={`rotulo-${no.id}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: posicao.x - LARGURA_DO_ROTULO / 2,
                  top: posicao.y + raioDoNo(no.peso) + ESPACO_DO_ROTULO,
                  width: LARGURA_DO_ROTULO,
                  textAlign: "center",
                  fontFamily: tipografia.rotuloSm.fontFamily,
                  fontSize: tipografia.rotuloSm.fontSize,
                  color: selecionado ? cores.grafoNoRotuloSelecionado : cores.grafoNoRotulo,
                }}
              >
                {no.titulo}
              </Text>
            );
          })}

          {nos.map((no) => {
            const posicao = posicoes.get(no.id);
            if (!posicao) return null;
            const alvo = raioDoNo(no.peso) + 10;
            return (
              <Pressable
                key={`alvo-${no.id}`}
                testID={`alvo-do-no-${no.id}`}
                accessibilityRole="button"
                accessibilityLabel={no.titulo}
                onPress={() => aoSelecionarNo(no.id)}
                style={{
                  position: "absolute",
                  left: posicao.x - alvo,
                  top: posicao.y - alvo,
                  width: alvo * 2,
                  height: alvo * 2,
                }}
              />
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
