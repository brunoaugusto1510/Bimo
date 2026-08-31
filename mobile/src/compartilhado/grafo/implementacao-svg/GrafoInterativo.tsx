import { useMemo } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg from "react-native-svg";
import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import { deveRotular } from "../fisica";
import { noMaisProximoDeCoordenada, paraCoordenadaDoGrafo } from "../posicionamento";
import { useSimulacao, type Posicao } from "../useSimulacao";
import { ArestaAnimada } from "./ArestaAnimada";
import { AlvoDoNoAnimado, NoAnimado, RotuloAnimado } from "./NoAnimado";

// Tempo de segurar antes de o nó grudar no dedo. Curto demais e navegar perto
// de um nó o arrastaria sem querer; longo demais e o gesto parece travado.
const DURACAO_PARA_PEGAR_MS = 250;

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

  const { posicoes, pegarNo, moverNoPego, soltarNo } = useSimulacao({
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

  // Arrays paralelos a `posicoes`, resolvidos uma vez: o worklet do gesto não
  // pode fechar sobre `nos`, que muda de forma a cada recarga do vault.
  const ids = useMemo(() => nos.map((no) => no.id), [nos]);
  const pesos = useMemo(() => nos.map((no) => no.peso), [nos]);

  const idPego = useSharedValue<string | null>(null);

  function pontoNoGrafo(x: number, y: number) {
    "worklet";
    return paraCoordenadaDoGrafo({ x, y }, zoom.value, { x: deslocamentoX.value, y: deslocamentoY.value });
  }

  const pegar = Gesture.LongPress()
    .minDuration(DURACAO_PARA_PEGAR_MS)
    .onStart((evento) => {
      const ponto = pontoNoGrafo(evento.x, evento.y);
      const indice = noMaisProximoDeCoordenada(posicoes.value, pesos, ponto);
      if (indice === null) return;
      idPego.value = ids[indice];
      pegarNo(ids[indice], ponto.x, ponto.y);
    });

  const arrastar = Gesture.Pan()
    .onChange((evento) => {
      // Com um nó preso ao dedo, o mesmo movimento não pode também arrastar a
      // tela: o nó viajaria o dobro da distância do dedo.
      if (idPego.value !== null) {
        const ponto = pontoNoGrafo(evento.x, evento.y);
        moverNoPego(idPego.value, ponto.x, ponto.y);
        return;
      }

      deslocamentoX.value += evento.changeX;
      deslocamentoY.value += evento.changeY;
    })
    .onEnd(() => {
      if (idPego.value === null) return;
      // Solta e as molas voltam a agir: o nó desliza e assenta perto de onde
      // foi largado, como no Obsidian.
      soltarNo(idPego.value);
      idPego.value = null;
    });

  const pincar = Gesture.Pinch().onChange((evento) => {
    zoom.value = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, zoom.value * evento.scaleChange));
  });

  // `Simultaneous` e não `Race`: o LongPress precisa amadurecer enquanto o Pan
  // já está ativo. O dedo parado por 250 ms não gera changeX/changeY, então a
  // navegação não se move nesse intervalo, e assim que `pegar` dispara a
  // guarda no onChange silencia o pan pelo resto do gesto.
  const gestos = Gesture.Simultaneous(pegar, arrastar, pincar);

  const estiloDaCamada = useAnimatedStyle(() => ({
    transform: [{ translateX: deslocamentoX.value }, { translateY: deslocamentoY.value }, { scale: zoom.value }],
  }));

  return (
    /*
      O GestureDetector precisa envolver ESTA view, e não a camada
      transformada de baixo. A camada é `pointerEvents="box-none"`, e para o
      RNGH isso significa `PointerEventsConfig.BOX_NONE`: os handlers dela só
      entram na disputa se algum descendente virar alvo do toque
      (GestureHandlerOrchestrator.kt, ramo BOX_NONE). E um descendente sem
      handler próprio só qualifica quando `view !is ViewGroup ||
      view.getBackground() != null` — o fundo e os alvos dos nós são
      ReactViewGroup sem background, então nenhum qualifica. Com o detector
      ali, arrastar, pinçar e segurar simplesmente não chegavam.

      Aqui o pointerEvents é o padrão (AUTO), e nesse ramo o orquestrador
      registra os handlers da própria view sem depender dos filhos. O
      `collapsable={false}` que o Android precisa é injetado pelo próprio
      GestureDetector (Wrap.tsx), então não é escrito aqui.
    */
    <GestureDetector gesture={gestos}>
      <View testID="grafo-interativo" style={StyleSheet.absoluteFill}>
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
      </View>
    </GestureDetector>
  );
}
