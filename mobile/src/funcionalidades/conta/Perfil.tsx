import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { carregarOuLogar } from "@/compartilhado/utils/carregarOuLogar";
import { AreaQueEvitaTeclado, Avatar, Botao, Cartao, Icone } from "@/compartilhado/ui";
import { useEstadoConta } from "./estado";

function Estatistica({ valor, rotulo }: { valor: number; rotulo: string }) {
  const { cores, tipografia } = useTema();
  return (
    <Cartao style={{ flex: 1 }}>
      <Text style={[tipografia.displayMd, { color: cores.sobreSuperficie }]}>{valor}</Text>
      <Text style={[tipografia.legenda, { color: cores.textoSuave }]}>{rotulo}</Text>
    </Cartao>
  );
}

function Campo({
  rotulo, valor, aoMudar, multilinha = false,
}: { rotulo: string; valor: string; aoMudar: (texto: string) => void; multilinha?: boolean }) {
  const { cores, tipografia, espacamento, raios } = useTema();
  return (
    <View style={{ marginBottom: espacamento.md }}>
      <Text style={[tipografia.rotuloSm, { color: cores.contorno, marginBottom: espacamento.xs }]}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        value={valor}
        onChangeText={aoMudar}
        multiline={multilinha}
        textAlignVertical={multilinha ? "top" : "center"}
        style={[
          tipografia.corpo,
          {
            color: cores.sobreSuperficie,
            backgroundColor: cores.superficieContainerBaixa,
            borderWidth: 1, borderColor: cores.fioDeCabelo, borderRadius: raios.cartao,
            paddingHorizontal: espacamento.md, paddingVertical: 10,
            minHeight: multilinha ? 88 : undefined,
          },
        ]}
      />
    </View>
  );
}

export function Perfil() {
  const { cores, tipografia, espacamento } = useTema();
  const router = useRouter();
  const { vault } = useServicos();
  const { perfil, definirPerfil } = useEstadoConta();

  const [rascunho, setRascunho] = useState(perfil);
  const [estatisticas, setEstatisticas] = useState({ notas: 0, conexoes: 0, pastas: 0 });

  useEffect(() => {
    carregarOuLogar(
      Promise.all([vault.listarNotas(), vault.listarArestas()]),
      ([notas, arestas]) => setEstatisticas({ notas: notas.length, conexoes: arestas.length, pastas: new Set(notas.map((nota) => nota.pasta)).size }),
      "Falha ao carregar estatísticas do vault",
    );
  }, [vault]);

  const iniciais = rascunho.nome.split(" ").slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();

  return (
    <AreaQueEvitaTeclado style={{ flex: 1, backgroundColor: cores.superficie }}>
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
        <Text style={[tipografia.titleMd, { color: cores.sobreSuperficie }]}>Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: espacamento.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: espacamento.md, marginBottom: espacamento.lg }}>
          <Avatar iniciais={iniciais} tamanho={64} />
          <View style={{ flex: 1, gap: espacamento.xs }}>
            <Botao variante="outline" rotulo="Trocar Foto" icone="person" aoTocar={() => {}} />
            <Text style={[tipografia.legenda, { color: cores.contorno }]}>Sem foto: iniciais em Teal Current.</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: espacamento.sm, marginBottom: espacamento.lg }}>
          <Estatistica valor={estatisticas.notas} rotulo="Notas" />
          <Estatistica valor={estatisticas.conexoes} rotulo="Conexões" />
          <Estatistica valor={estatisticas.pastas} rotulo="Pastas" />
        </View>

        <Campo rotulo="Nome" valor={rascunho.nome} aoMudar={(nome) => setRascunho({ ...rascunho, nome })} />
        <Campo rotulo="E-mail" valor={rascunho.email} aoMudar={(email) => setRascunho({ ...rascunho, email })} />
        <Campo rotulo="Como o Bimo deve te tratar" valor={rascunho.comoMeTratar} aoMudar={(comoMeTratar) => setRascunho({ ...rascunho, comoMeTratar })} multilinha />

        <Botao variante="primario" rotulo="Salvar Alterações" aoTocar={() => definirPerfil(rascunho)} larguraTotal />

        <View style={{ marginTop: espacamento.lg, paddingTop: espacamento.md, borderTopWidth: 1, borderTopColor: cores.fioDeCabelo }}>
          <Botao variante="ghost" rotulo="Sair da Conta" icone="logout" aoTocar={() => router.replace("/intro")} />
        </View>
      </ScrollView>
    </AreaQueEvitaTeclado>
  );
}
