import { useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { carregarOuLogar } from "@/compartilhado/utils/carregarOuLogar";
import { CampoDeGrafo } from "@/compartilhado/grafo";
import { useEstadoGrafo } from "@/funcionalidades/grafo/estado";
import { useEstadoConta } from "@/funcionalidades/conta/estado";
import type { Mensagem, Nota } from "@/dados/tipos";
import { Bolha } from "./componentes/Bolha";
import { CartaoDeResultado } from "./componentes/CartaoDeResultado";
import { IndicadorDeDigitacao } from "./componentes/IndicadorDeDigitacao";
import { Composer } from "./componentes/Composer";
import { useEstadoChat } from "./estado";

export function Chat() {
  const { espacamento } = useTema();
  const router = useRouter();
  const { vault, ia } = useServicos();
  const { mensagens, rascunho, digitando, definirRascunho, enviar } = useEstadoChat();
  const pulsar = useEstadoGrafo((estado) => estado.pulsar);
  const pulso = useEstadoGrafo((estado) => estado.pulso);
  const crescerContador = useEstadoGrafo((estado) => estado.crescer);
  const grafoLigado = useEstadoConta((estado) => estado.interruptores.grafo);
  const particulasLigadas = useEstadoConta((estado) => estado.interruptores.particulas);
  const densidade = useEstadoConta((estado) => estado.densidade);
  const [notas, setNotas] = useState<Nota[]>([]);
  const lista = useRef<FlatList<Mensagem>>(null);

  useEffect(() => {
    carregarOuLogar(vault.listarNotas(), setNotas, "Falha ao listar notas do vault");
  }, [vault]);

  useEffect(() => {
    lista.current?.scrollToEnd({ animated: true });
  }, [mensagens.length, digitando]);

  return (
    <View style={{ flex: 1 }}>
      <CampoDeGrafo
        modo="ambiente"
        densidade={densidade}
        ligado={grafoLigado}
        particulasLigadas={particulasLigadas}
        pulso={pulso}
        crescer={crescerContador}
      />
      <FlatList<Mensagem>
        ref={lista}
        data={mensagens}
        keyExtractor={(mensagem) => mensagem.id}
        contentContainerStyle={{ padding: espacamento.gutter, gap: espacamento.gutter }}
        renderItem={({ item }) => (
          <Bolha autor={item.autor} texto={item.texto} horario={item.horario}>
            {item.cartoes?.map((id) => {
              const nota = notas.find((candidata) => candidata.id === id);
              if (!nota) return null;
              // A rota /editor/[id] só chega na Task 14 — o cast evita que o
              // typed-routes do expo-router barre a compilação antes de ela
              // existir; tocar num cartão hoje falha em navegar, como esperado.
              return (
                <CartaoDeResultado
                  key={id}
                  nota={nota}
                  aoTocar={() => router.push(`/editor/${nota.id}` as Href)}
                />
              );
            })}
          </Bolha>
        )}
        ListFooterComponent={digitando ? <IndicadorDeDigitacao /> : null}
      />
      <Composer valor={rascunho} aoMudar={definirRascunho} aoEnviar={() => void enviar(ia, pulsar)} />
    </View>
  );
}
