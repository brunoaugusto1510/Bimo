import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { Cartao, Icone, Interruptor, Pill, Sobrancelha } from "@/compartilhado/ui";
import { LinhaDeConfiguracao } from "./componentes/LinhaDeConfiguracao";
import { useEstadoConta, type Densidade } from "./estado";

const DENSIDADES: Densidade[] = [50, 60, 80];

export function Configuracoes() {
  const { cores, tipografia, espacamento } = useTema();
  const router = useRouter();
  const { interruptores, densidade, alternar, definirDensidade } = useEstadoConta();

  return (
    <View style={{ flex: 1, backgroundColor: cores.superficie }}>
      <View style={{ minHeight: espacamento.alturaCabecalho, flexDirection: "row", alignItems: "center", gap: espacamento.sm, paddingHorizontal: espacamento.md, borderBottomWidth: 1, borderBottomColor: cores.fioDeCabelo }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          hitSlop={8}
        >
          <Icone nome="arrow_back" tamanho={22} cor={cores.sobreSuperficie} />
        </Pressable>
        <Text style={[tipografia.titleMd, { color: cores.sobreSuperficie }]}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: espacamento.lg, paddingVertical: espacamento.gutter }}>
        <Cartao>
          <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md }}>
            <Icone nome="cloud" tamanho={20} cor={cores.secundaria} />
            <View style={{ flex: 1 }}>
              <Text style={[tipografia.corpoMedio, { color: cores.sobreSuperficie }]}>Sincronizado</Text>
              <Text style={[tipografia.legenda, { color: cores.textoSuave }]}>642 notas · há 2 minutos</Text>
            </View>
            <Icone nome="sync" tamanho={18} cor={cores.contorno} />
          </View>
        </Cartao>

        <Sobrancelha texto="GRAFO DE FUNDO" />
        <LinhaDeConfiguracao rotulo="Campo do grafo" hint="Nós à deriva atrás do conteúdo">
          <Interruptor ligado={interruptores.grafo} aoMudar={() => alternar("grafo")} rotuloAcessivel="Campo do grafo" />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao rotulo="Partículas de raciocínio" hint="Iris viaja pelas ligações quando o Bimo pensa">
          <Interruptor ligado={interruptores.particulas} aoMudar={() => alternar("particulas")} rotuloAcessivel="Partículas de raciocínio" />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao rotulo="Densidade de nós" hint={`${densidade} nós no campo de fundo`}>
          <View style={{ flexDirection: "row", gap: espacamento.sm }}>
            {DENSIDADES.map((valor) => (
              <Pill key={valor} rotulo={String(valor)} ativo={valor === densidade} aoTocar={() => definirDensidade(valor)} />
            ))}
          </View>
        </LinhaDeConfiguracao>

        <Sobrancelha texto="INTELIGÊNCIA" />
        <LinhaDeConfiguracao rotulo="Extrair tags ao salvar" hint="Sempre como sugestão, nunca automático">
          <Interruptor ligado={interruptores.tagsAutomaticas} aoMudar={() => alternar("tagsAutomaticas")} rotuloAcessivel="Extrair tags ao salvar" />
        </LinhaDeConfiguracao>
        <LinhaDeConfiguracao rotulo="Sugerir links enquanto escrevo" hint="Mais interrupções, mais conexões">
          <Interruptor ligado={interruptores.linksAutomaticos} aoMudar={() => alternar("linksAutomaticos")} rotuloAcessivel="Sugerir links enquanto escrevo" />
        </LinhaDeConfiguracao>

        <Sobrancelha texto="SINCRONIZAÇÃO" />
        <LinhaDeConfiguracao rotulo="Sincronizar só no Wi-Fi" hint="Vault local continua disponível offline">
          <Interruptor ligado={interruptores.somenteWifi} aoMudar={() => alternar("somenteWifi")} rotuloAcessivel="Sincronizar só no Wi-Fi" />
        </LinhaDeConfiguracao>

        <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.sm, marginTop: espacamento.xl }}>
          <Icone nome="info" tamanho={20} cor={cores.contorno} />
          <Text style={[tipografia.legenda, { color: cores.contorno }]}>Bimo 1.4.0 · vault local com sincronização</Text>
        </View>
      </ScrollView>
    </View>
  );
}
