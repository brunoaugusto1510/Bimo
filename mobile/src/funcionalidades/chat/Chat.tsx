import { useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useTema } from "@/compartilhado/tema";
import { useServicos } from "@/servicos";
import { CampoDeGrafo } from "@/compartilhado/grafo";
import { useEstadoGrafo } from "@/funcionalidades/grafo/estado";
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
  // Stub: useEstadoConta chega na Task 15. Até lá, os interruptores e a
  // densidade ficam fixos aqui — trocar pelo hook de verdade quando ele
  // existir (ver `mobile/src/funcionalidades/conta/estado.ts`).
  const interruptores = { grafo: true, particulas: true };
  const densidade = 60;
  const [notas, setNotas] = useState<Nota[]>([]);
  const lista = useRef<FlatList<Mensagem>>(null);

  useEffect(() => {
    vault.listarNotas().then(setNotas);
  }, [vault]);

  useEffect(() => {
    lista.current?.scrollToEnd({ animated: true });
  }, [mensagens.length, digitando]);

  return (
    <View style={{ flex: 1 }}>
      <CampoDeGrafo
        modo="ambiente"
        densidade={densidade}
        ligado={interruptores.grafo}
        particulasLigadas={interruptores.particulas}
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
