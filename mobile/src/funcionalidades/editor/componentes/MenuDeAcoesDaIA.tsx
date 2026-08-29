import { Pressable, Text, View } from "react-native";
import { useTema } from "@/compartilhado/tema";
import { Icone, Sheet, type NomeDeIcone } from "@/compartilhado/ui";
import type { TipoDeAcaoIA } from "@/dados/tipos";

const ACOES: { tipo: TipoDeAcaoIA; rotulo: string; icone: NomeDeIcone }[] = [
  { tipo: "links", rotulo: "Sugerir links", icone: "hub" },
  { tipo: "resumo", rotulo: "Resumir a nota", icone: "description" },
  { tipo: "tags", rotulo: "Extrair tags", icone: "sell" },
  { tipo: "continuar", rotulo: "Continuar escrevendo", icone: "edit" },
  { tipo: "perguntar", rotulo: "Perguntar sobre a nota", icone: "forum" },
];

export function MenuDeAcoesDaIA({
  aberto,
  aoFechar,
  aoEscolher,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoEscolher: (tipo: TipoDeAcaoIA) => void;
}) {
  const { cores, tipografia, espacamento, raios } = useTema();

  return (
    <Sheet aberta={aberto} aoFechar={aoFechar} sobrancelha="BIMO NESTA NOTA">
      <View>
        {ACOES.map((acao) => (
          <Pressable
            key={acao.tipo}
            accessibilityRole="button"
            accessibilityLabel={acao.rotulo}
            onPress={() => aoEscolher(acao.tipo)}
            style={{
              minHeight: espacamento.alvoDeToque,
              flexDirection: "row",
              alignItems: "center",
              gap: espacamento.md,
              paddingHorizontal: espacamento.md,
              paddingVertical: espacamento.sm,
              borderRadius: raios.cartao,
            }}
          >
            <Icone nome={acao.icone} tamanho={20} cor={cores.primaria} />
            <Text style={[tipografia.corpo, { color: cores.sobreSuperficie }]}>{acao.rotulo}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
