import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTema } from "@/compartilhado/tema";
import { Botao, Chip, Icone } from "@/compartilhado/ui";
import type { Sugestao } from "@/dados/tipos";

export function CartaoDeSugestao({
  sugestao,
  aoInserir,
  aoDescartar,
}: {
  sugestao: Sugestao;
  aoInserir: () => void;
  aoDescartar: () => void;
}) {
  const { cores, tipografia, espacamento, raios } = useTema();

  return (
    <Animated.View
      // FadeInDown puro entra com translateY: 25 por padrão (Fade.ts) — mais
      // de seis vezes o deslocamento de 4px que o design pede.
      // withInitialValues sobrescreve só o transform inicial, mantendo a
      // duração e o fade.
      entering={FadeInDown.duration(200).withInitialValues({ transform: [{ translateY: 4 }] })}
      style={{
        marginTop: espacamento.gutter,
        padding: espacamento.md,
        borderRadius: raios.cartao,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: cores.primaria,
        backgroundColor: cores.primariaFixa,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icone nome="psychology" tamanho={16} cor={cores.primaria} />
        <Text style={[tipografia.rotuloSm, { color: cores.sobrePrimariaFixaVariante }]}>{`Sugestão do Bimo · ${sugestao.rotulo}`}</Text>
      </View>

      <Text style={[tipografia.corpoRelaxado, { color: cores.sobreSuperficie, marginTop: espacamento.sm }]}>{sugestao.texto}</Text>

      {sugestao.tags ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espacamento.sm, marginTop: espacamento.sm }}>
          {sugestao.tags.map((tag) => (
            <Chip key={tag} rotulo={tag} destacado />
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: espacamento.sm, marginTop: espacamento.md }}>
        <Botao variante="primario" rotulo="Inserir" icone="add" aoTocar={aoInserir} />
        <Botao variante="ghost" rotulo="Descartar" aoTocar={aoDescartar} />
      </View>
    </Animated.View>
  );
}
