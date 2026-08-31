/* eslint-disable react-hooks/immutability -- O React Compiler modela todo valor
   criado no corpo do hook como imutável, mas o shared value do Reanimated é
   exatamente o oposto: uma caixa mutável de identidade estável, e mutá-la é a
   API oficial da biblioteca. A regra aceita mutar num efeito OU num callback,
   nunca nos dois — e é isso que este arquivo precisa fazer, porque a altura
   muda tanto por fora (store) quanto pelo dedo (gesto). */
import { useEffect, useRef } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTema } from "@/compartilhado/tema";
import { Botao, CampoDeBusca, Sobrancelha, Vidro } from "@/compartilhado/ui";
import type { Nota } from "@/dados/tipos";
import { alternarAltura, proximaAltura } from "../alturaDaFolha";
import { CartaoDeNota } from "./CartaoDeNota";

type Props = {
  notas: Nota[];
  busca: string;
  aoBuscar: (texto: string) => void;
  noSelecionado: string | null;
  aoSelecionarNota: (id: string) => void;
  aoLimparSelecao: () => void;
  altura: number;
  alturaMinima: number;
  alturaMaxima: number;
  aoArrastar: (altura: number) => void;
  aoMedirMinimo: (altura: number) => void;
  aoAbrirNota: () => void;
  aoPerguntar: () => void;
};

export function FolhaDeNotas(props: Props) {
  const { cores, espacamento, raios, sombras, movimento } = useTema();
  const altura = useSharedValue(props.altura);

  // A prop é a altura assentada (vem do store); o shared value é o que se
  // move durante o arrasto. Quando a altura muda por fora do gesto — toque na
  // alça, seleção de nó, rotação —, o shared value precisa acompanhar.
  //
  // A primeira medida real é o caso que não pode animar: a altura sai de 0
  // ("o layout ainda não chegou") para a média do aparelho, e um withTiming aí
  // vira uma animação de entrada que o design não pede.
  const alturaAnterior = useRef(props.altura);
  useEffect(() => {
    if (alturaAnterior.current === props.altura) return;

    if (alturaAnterior.current === 0) {
      altura.value = props.altura;
    } else {
      altura.value = withTiming(props.altura, {
        duration: movimento.duracaoLenta,
        easing: movimento.curvaPadrao,
      });
    }

    alturaAnterior.current = props.altura;
  }, [props.altura, altura, movimento]);

  // As duas medidas chegam em eventos separados; o mínimo só é reportado
  // quando as duas existem, senão o store receberia um mínimo pela metade e
  // clamparia a bandeja no lugar errado.
  const medidas = useRef<{ alca: number | null; rodape: number | null }>({ alca: null, rodape: null });
  function medir(parte: "alca" | "rodape", medida: number) {
    medidas.current[parte] = medida;
    const { alca, rodape } = medidas.current;
    if (alca !== null && rodape !== null) props.aoMedirMinimo(alca + rodape);
  }

  const arrastar = Gesture.Pan()
    .onChange((evento) => {
      // Dedo para cima (changeY negativo) aumenta a bandeja, daí o sinal.
      altura.value = proximaAltura(altura.value, -evento.changeY, props.alturaMinima, props.alturaMaxima);
    })
    .onEnd(() => {
      // Só ao soltar o valor volta para o store: gravar a cada quadro
      // re-renderizaria a árvore inteira 120 vezes por segundo.
      runOnJS(props.aoArrastar)(altura.value);
    });

  const estilo = useAnimatedStyle(() => ({ height: altura.value }));

  return (
    <Animated.View testID="folha-de-notas" style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, estilo]}>
      <Vidro
        nivel="folha"
        style={[
          {
            flex: 1,
            borderTopLeftRadius: raios.folha,
            borderTopRightRadius: raios.folha,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: cores.fioDeCabelo,
            overflow: "hidden",
          },
          sombras.grande,
        ]}
      >
        {/*
          O arrasto é gesto do RNGH; o toque continua um `Pressable` do RN
          dentro dele. Não é redundância: `Gesture.Tap` não é alcançável por
          `fireEvent.press` no Jest, e o Pressable é o que dá o
          `accessibilityRole`/`accessibilityLabel` que o leitor de tela anuncia.
          O Pressable responde ao toque sem movimento; o Pan ativa quando há
          movimento e cancela o press.
        */}
        <GestureDetector gesture={arrastar}>
          <Pressable
            testID="alca-da-folha"
            accessibilityRole="button"
            accessibilityLabel="Ajustar altura da lista"
            onLayout={(evento) => medir("alca", evento.nativeEvent.layout.height)}
            onPress={() => props.aoArrastar(alternarAltura(props.altura, props.alturaMinima, props.alturaMaxima))}
            // minHeight no alvo de toque mínimo (44px), não no tamanho visual
            // da alça — a barra continua 36×4, só o alvo que fica maior.
            style={{
              minHeight: espacamento.alvoDeToque,
              paddingTop: espacamento.sm,
              paddingBottom: espacamento.xs,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: cores.contorno, opacity: 0.45 }} />
          </Pressable>
        </GestureDetector>

        {/*
          `flex: 1, minHeight: 0` é o que permite a bandeja chegar ao mínimo
          mostrando só alça e rodapé: o miolo encolhe até desaparecer, e o
          rodapé, sem flex, mantém o tamanho natural.
        */}
        <View testID="miolo-da-folha" style={{ flex: 1, minHeight: 0 }}>
          <View style={{ paddingHorizontal: espacamento.gutter }}>
            <CampoDeBusca valor={props.busca} aoMudar={props.aoBuscar} placeholder="Buscar no vault..." />
          </View>

          <Sobrancelha
            texto={props.noSelecionado ? "NOTAS CONECTADAS" : "NOTAS RECENTES"}
            acao={props.noSelecionado ? { rotulo: "limpar", icone: "close", aoTocar: props.aoLimparSelecao } : undefined}
          />

          <FlatList
            data={props.notas}
            keyExtractor={(nota) => nota.id}
            contentContainerStyle={{ paddingHorizontal: espacamento.md, gap: espacamento.sm }}
            renderItem={({ item }) => (
              <CartaoDeNota
                nota={item}
                selecionado={item.id === props.noSelecionado}
                aoTocar={() => props.aoSelecionarNota(item.id)}
              />
            )}
          />
        </View>

        <View
          testID="rodape-da-folha"
          onLayout={(evento) => medir("rodape", evento.nativeEvent.layout.height)}
          style={{
            flexDirection: "row",
            gap: espacamento.sm,
            paddingHorizontal: espacamento.md,
            paddingBottom: espacamento.md,
          }}
        >
          {props.noSelecionado ? (
            <>
              <Botao variante="primario" rotulo="Abrir Nota" icone="description" aoTocar={props.aoAbrirNota} larguraTotal />
              <Botao variante="outline" rotulo="Perguntar" icone="forum" aoTocar={props.aoPerguntar} />
            </>
          ) : (
            <Botao variante="primario" rotulo="+ Nova Nota" aoTocar={props.aoAbrirNota} larguraTotal />
          )}
        </View>
      </Vidro>
    </Animated.View>
  );
}
