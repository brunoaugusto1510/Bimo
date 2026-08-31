import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { carregarOuLogar } from "@/compartilhado/utils/carregarOuLogar";
import { AreaQueEvitaTeclado, Chip, Icone } from "@/compartilhado/ui";
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
  // `notaCarregada` só é preenchida quando o fetch resolve E ainda for a
  // busca mais recente (ver o efeito abaixo). Enquanto isso — ou para o
  // `id` "nova", que não busca nada — `nota` cai no casco derivado do `id`
  // atual, calculado na renderização em vez de guardado em estado: isso
  // mantém `nota` correta assim que `id` muda, sem precisar de um
  // `setState` síncrono dentro do efeito.
  const [notaCarregada, setNotaCarregada] = useState<Nota | null>(null);
  const [nosNovos, setNosNovos] = useState(0);
  const nota = notaCarregada?.id === id ? notaCarregada : cascoDaNota(id);
  // A nota "nova" não busca nada — está pronta desde o primeiro render. Uma
  // nota existente só está pronta quando o fetch já preencheu `notaCarregada`
  // com o `id` atual. Usado para desabilitar o gatilho da IA (ver abaixo).
  const notaPronta = id === "nova" || notaCarregada?.id === id;

  useEffect(() => {
    // `abrirNota` zera o estado do editor para esta nota, de forma síncrona,
    // e devolve um token que identifica esta abertura de forma única. Se o
    // usuário rodar uma ação da IA ou digitar algo enquanto `vault.obterNota`
    // ainda está no ar, a store recusa aplicar o conteúdo que chegar depois
    // por cima disso (ver o comentário em `estado.ts`).
    const token = editor.abrirNota(id);
    if (id === "nova") return;

    carregarOuLogar(
      vault.obterNota(id),
      (encontrada) => {
        // Descarta uma resposta obsoleta: uma abertura mais recente já
        // aconteceu — nesta mesma instância (o `id` mudou de novo) ou numa
        // instância diferente do Editor (esta nota foi fechada e outra foi
        // aberta) — antes deste fetch, mais lento, ter terminado. Comparar
        // com `useEstadoEditor.getState()` (não com o `editor` do closure,
        // que é só um snapshot da renderização em que o efeito foi criado)
        // garante que a checagem usa o token mais atual da store no instante
        // em que a promise resolve.
        if (useEstadoEditor.getState().tokenDeCarregamento !== token) return;
        setNotaCarregada(encontrada);
        editor.aplicarConteudo(encontrada, token);
      },
      "Falha ao carregar nota do vault",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, vault]);

  function acenderNo() {
    crescerNo();
    setNosNovos((total) => total + 1);
  }

  return (
    <AreaQueEvitaTeclado style={{ flex: 1, backgroundColor: cores.superficie }}>
      <BarraDoEditor
        pasta={nota.pasta}
        aoVoltar={() => router.back()}
        aoFechar={() => router.back()}
        aoAbrirIA={editor.abrirMenu}
        iaDesabilitada={!notaPronta}
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
          placeholder="Comece a escrever..."
          placeholderTextColor={cores.textoPlaceholder}
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
    </AreaQueEvitaTeclado>
  );
}
