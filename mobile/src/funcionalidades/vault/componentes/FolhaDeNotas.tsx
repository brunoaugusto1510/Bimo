import { useEffect } from "react";
import { FlatList, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTema } from "@/compartilhado/tema";
import { Botao, CampoDeBusca, Sobrancelha, Vidro } from "@/compartilhado/ui";
import type { Nota } from "@/dados/tipos";
import type { PassoDaFolha } from "../estado";
import { CartaoDeNota } from "./CartaoDeNota";

const FRACOES: Record<PassoDaFolha, number> = { 0: 0.34, 1: 0.58, 2: 0.8 };

// `onLayout` nunca dispara no ambiente de teste — sem esse valor de reserva
// a folha calcularia altura 0 a partir de `alturaDisponivel` e nenhum
// cartão apareceria, o que quebraria os próprios testes deste componente.
// Num aparelho real `onLayout` sempre dispara, então este valor só é usado
// em teste.
const ALTURA_DE_RESERVA = 560;

type Props = {
  notas: Nota[];
  busca: string;
  aoBuscar: (texto: string) => void;
  noSelecionado: string | null;
  aoSelecionarNota: (id: string) => void;
  aoLimparSelecao: () => void;
  passo: PassoDaFolha;
  aoAvancarPasso: () => void;
  alturaDisponivel: number;
  aoAbrirNota: () => void;
  aoPerguntar: () => void;
};

export function FolhaDeNotas(props: Props) {
  const { cores, espacamento, raios, sombras, movimento } = useTema();
  const base = props.alturaDisponivel > 0 ? props.alturaDisponivel : ALTURA_DE_RESERVA;
  const altura = useSharedValue(base * FRACOES[props.passo]);

  useEffect(() => {
    altura.value = withTiming(base * FRACOES[props.passo], {
      duration: movimento.duracaoLenta,
      easing: movimento.curvaPadrao,
    });
  }, [props.passo, base, altura, movimento]);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajustar altura da lista"
          onPress={props.aoAvancarPasso}
          // minHeight no alvo de toque mínimo (44px), não no tamanho visual
          // da alça — a barra continua 36×4, só o Pressable que a envolve
          // fica mais alto para o toque continuar confortável.
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

        <View style={{ flexDirection: "row", gap: espacamento.sm, paddingHorizontal: espacamento.md, paddingBottom: espacamento.md }}>
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
