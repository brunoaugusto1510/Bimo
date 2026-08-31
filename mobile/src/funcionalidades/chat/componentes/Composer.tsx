import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone, Vidro } from "@/compartilhado/ui";

type Props = { valor: string; aoMudar: (texto: string) => void; aoEnviar: () => void };

export function Composer({ valor, aoMudar, aoEnviar }: Props) {
  const { cores, tipografia, espacamento, raios, sombras } = useTema();
  const [focado, setFocado] = useState(false);

  return (
    <View>
      {/*
        Aqui havia uma faixa `LinearGradient` de 96px com `cores.protecaoDock`,
        de ponta a ponta atras do dock. No tema escuro ela lia como um
        retangulo escuro cortando o fim da conversa, em vez de um degrade. O
        vidro do proprio dock ja separa o composer do chat, entao a faixa so
        somava peso visual.
      */}
      <View style={{ paddingHorizontal: espacamento.gutter, paddingTop: espacamento.sm, paddingBottom: espacamento.md }}>
        <Vidro
          testID="vidro-do-dock"
          nivel="dock"
          style={[
            { padding: espacamento.xs, borderRadius: raios.folha, borderWidth: 1, borderColor: focado ? cores.primaria : cores.fioDeCabelo, overflow: "hidden" },
            sombras.grande,
          ]}
        >
          <TextInput
            value={valor}
            onChangeText={aoMudar}
            onFocus={() => setFocado(true)}
            onBlur={() => setFocado(false)}
            placeholder="Pergunte ao Bimo ou consulte seu vault..."
            placeholderTextColor={cores.textoPlaceholder}
            // Sem isto o Android Autofill tratava o campo como formulario e
            // abria a faixa de sugestoes inline (enderecos de e-mail!) por cima
            // do teclado. Essa faixa fica fora do `getWindowVisibleDisplayFrame`
            // de onde sai o `screenY` do `keyboardDidShow`
            // (`ReactRootView.java:951` e `:977`), entao a `AreaQueEvitaTeclado`
            // levantava o composer ate o topo do IME e a faixa seguia cobrindo o
            // fim dele.
            autoComplete="off"
            importantForAutofill="no"
            multiline
            style={[tipografia.corpo, { color: cores.sobreSuperficie, minHeight: 46, maxHeight: espacamento.alturaMaximaComposer, padding: espacamento.md }]}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md, paddingHorizontal: espacamento.sm, paddingBottom: espacamento.xs }}>
            <Icone nome="attach_file" tamanho={20} cor={cores.contorno} />
            <Icone nome="center_focus_strong" tamanho={20} cor={cores.contorno} />
            <View style={{ flex: 1 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar"
              onPress={aoEnviar}
              style={{ width: 32, height: 32, borderRadius: raios.cartao, backgroundColor: cores.primaria, alignItems: "center", justifyContent: "center" }}
              hitSlop={8}
            >
              <Icone nome="arrow_upward" tamanho={18} cor={cores.sobrePrimaria} />
            </Pressable>
          </View>
        </Vidro>
      </View>
    </View>
  );
}
