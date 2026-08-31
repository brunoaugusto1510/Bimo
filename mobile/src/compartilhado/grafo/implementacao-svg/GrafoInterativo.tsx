import { useMemo } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg from "react-native-svg";
import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import { deveRotular } from "../fisica";
import { useSimulacao, type Posicao } from "../useSimulacao";
import { ArestaAnimada } from "./ArestaAnimada";
import { AlvoDoNoAnimado, NoAnimado, RotuloAnimado } from "./NoAnimado";

const ZOOM_MINIMO = 0.6;
const ZOOM_MAXIMO = 2.4;

type Props = {
  nos: NoDoGrafo[];
  arestas: Aresta[];
  noSelecionado: string | null;
  aoSelecionarNo: (id: string | null) => void;
  posicoesIniciais?: Record<string, Posicao>;
  aoAssentarLayout?: (posicoes: Posicao[]) => void;
};

export function GrafoInterativo({
  nos,
  arestas,
  noSelecionado,
  aoSelecionarNo,
  posicoesIniciais,
  aoAssentarLayout,
}: Props) {
  const { width: largura, height: altura } = useWindowDimensions();

  const deslocamentoX = useSharedValue(0);
  const deslocamentoY = useSharedValue(0);
  const zoom = useSharedValue(1);

  const { posicoes } = useSimulacao({
    nos,
    arestas,
    largura,
    altura,
    posicoesIniciais,
    aoEsfriar: aoAssentarLayout,
  });

  // Índices resolvidos fora do render de cada aresta: o componente animado só
  // precisa saber quais duas posições ler.
  const ligacoes = useMemo(() => {
    const indicePorId = new Map(nos.map((no, indice) => [no.id, indice]));
    return arestas.flatMap((aresta) => {
      const de = indicePorId.get(aresta.de);
      const para = indicePorId.get(aresta.para);
      return de === undefined || para === undefined ? [] : [{ de, para, chave: `${aresta.de}-${aresta.para}` }];
    });
  }, [nos, arestas]);

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
            {ligacoes.map((ligacao) => (
              <ArestaAnimada key={ligacao.chave} posicoes={posicoes} de={ligacao.de} para={ligacao.para} />
            ))}

            {nos.map((no, indice) => (
              <NoAnimado
                key={no.id}
                id={no.id}
                posicoes={posicoes}
                indice={indice}
                peso={no.peso}
                selecionado={no.id === noSelecionado}
              />
            ))}
          </Svg>

          {nos.map((no, indice) =>
            deveRotular(no.peso, no.id === noSelecionado) ? (
              <RotuloAnimado
                key={`rotulo-${no.id}`}
                posicoes={posicoes}
                indice={indice}
                peso={no.peso}
                selecionado={no.id === noSelecionado}
                titulo={no.titulo}
              />
            ) : null,
          )}

          {nos.map((no, indice) => (
            <AlvoDoNoAnimado
              key={`alvo-${no.id}`}
              posicoes={posicoes}
              indice={indice}
              peso={no.peso}
              id={no.id}
              titulo={no.titulo}
              aoTocar={() => aoSelecionarNo(no.id)}
            />
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
