import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { Chip, Icone } from "@/compartilhado/ui";
import { useEstadoGrafo } from "@/funcionalidades/grafo/estado";
import type { Nota } from "@/dados/tipos";
import { BarraDoEditor } from "./componentes/BarraDoEditor";
import { MenuDeAcoesDaIA } from "./componentes/MenuDeAcoesDaIA";
import { CartaoDeSugestao } from "./componentes/CartaoDeSugestao";
import { useEstadoEditor } from "./estado";

const NOTA_NOVA: Nota = { id: "nova", titulo: "", pasta: "Zettelkasten", tags: [], corpo: "", resumo: "", editadaEm: "", conexoes: 0 };

function cascoDaNota(id: string): Nota {
  return id === "nova" ? NOTA_NOVA : { ...NOTA_NOVA, id, pasta: "" };
}

export function Editor() {
  const { cores, tipografia, espacamento } = useTema();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { vault, ia } = useServicos();
  const pulsar = useEstadoGrafo((estado) => estado.pulsar);
  const crescerNo = useEstadoGrafo((estado) => estado.crescerNo);
  const editor = useEstadoEditor();
  // `notaCarregada` só é preenchida quando o fetch resolve (dentro do
  // `.then()`, nunca de forma síncrona no corpo do efeito). Enquanto isso —
  // ou para o `id` "nova", que não busca nada — `nota` cai no casco derivado
  // do `id` atual, calculado na renderização em vez de guardado em estado:
  // isso mantém `nota` correta assim que `id` muda, sem precisar de um
  // `setState` síncrono dentro do efeito.
  const [notaCarregada, setNotaCarregada] = useState<Nota | null>(null);
  const [nosNovos, setNosNovos] = useState(0);
  const nota = notaCarregada?.id === id ? notaCarregada : cascoDaNota(id);

  useEffect(() => {
    // Marca a nota como aberta já aqui, de forma síncrona, antes do fetch
    // sequer começar. Se o usuário rodar uma ação da IA enquanto
    // `vault.obterNota` ainda está no ar, o `carregar()` abaixo — quando o
    // fetch chegar — vai reconhecer que é a mesma nota já aberta (mesmo
    // `id`) e não vai apagar a sugestão que acabou de chegar. Ver o
    // comentário em `estado.ts`.
    editor.carregar(cascoDaNota(id));
    if (id === "nova") return;

    vault.obterNota(id).then((encontrada) => {
      setNotaCarregada(encontrada);
      editor.carregar(encontrada);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, vault]);

  function acenderNo() {
    crescerNo();
    setNosNovos((total) => total + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: cores.superficie }}>
      <BarraDoEditor
        pasta={nota.pasta}
        aoVoltar={() => router.back()}
        aoFechar={() => router.back()}
        aoAbrirIA={editor.abrirMenu}
      />

      <ScrollView contentContainerStyle={{ padding: espacamento.lg }}>
        <TextInput
          value={editor.titulo}
          onChangeText={editor.definirTitulo}
          placeholder="Título da nota"
          placeholderTextColor={cores.textoPlaceholder}
          style={[
            tipografia.displayMd,
            {
              color: cores.primaria,
              borderBottomWidth: 1,
              borderBottomColor: cores.fioDeCabelo,
              paddingBottom: espacamento.sm,
              marginBottom: espacamento.md,
            },
          ]}
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espacamento.sm, marginBottom: espacamento.lg }}>
          {editor.tags.map((tag) => (
            <Chip key={tag} rotulo={tag} />
          ))}
        </View>

        <TextInput
          value={editor.texto}
          onChangeText={(texto) => editor.digitarTexto(texto, acenderNo)}
          multiline
          textAlignVertical="top"
          style={[tipografia.corpoRelaxado, { color: cores.sobreSuperficie, minHeight: 240 }]}
        />

        {editor.sugestao ? (
          <CartaoDeSugestao
            sugestao={editor.sugestao}
            aoInserir={() => editor.inserirSugestao(acenderNo)}
            aoDescartar={editor.descartarSugestao}
          />
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: espacamento.sm,
            marginTop: espacamento.xl,
            paddingTop: espacamento.md,
            borderTopWidth: 1,
            borderTopColor: cores.fioDeCabelo,
          }}
        >
          <Icone nome="hub" tamanho={16} cor={cores.contorno} />
          <Text style={[tipografia.legenda, { color: cores.contorno }]}>
            {nosNovos === 0 ? "O grafo acompanha o que você escreve" : `${nosNovos} ${nosNovos === 1 ? "nó novo acendeu" : "nós novos acenderam"} no grafo`}
          </Text>
        </View>
      </ScrollView>

      <MenuDeAcoesDaIA
        aberto={editor.menuIA}
        aoFechar={editor.fecharMenu}
        aoEscolher={(tipo) => editor.rodarAcao(ia, tipo, nota, pulsar)}
      />
    </View>
  );
}
