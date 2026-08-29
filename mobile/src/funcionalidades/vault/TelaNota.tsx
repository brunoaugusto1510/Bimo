import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useServicos } from "@/servicos";
import { carregarOuLogar } from "@/compartilhado/utils/carregarOuLogar";
import { CampoDeGrafo } from "@/compartilhado/grafo";
import { useEstadoGrafo } from "@/funcionalidades/grafo/estado";
import { useEstadoChat } from "@/funcionalidades/chat/estado";
import { useEstadoConta } from "@/funcionalidades/conta/estado";
import type { Aresta, Nota } from "@/dados/tipos";
import { filtrarNotas, montarGrafo, vizinhosDe } from "./grafoDoVault";
import { useEstadoVault } from "./estado";
import { FolhaDeNotas } from "./componentes/FolhaDeNotas";
import { ChipsDeContexto } from "./componentes/ChipsDeContexto";

export function TelaNota() {
  const router = useRouter();
  const { vault } = useServicos();
  const { busca, noSelecionado, passoDaFolha, definirBusca, selecionarNo, limparSelecao, avancarPasso } = useEstadoVault();
  const pulso = useEstadoGrafo((estado) => estado.pulso);
  const crescer = useEstadoGrafo((estado) => estado.crescer);
  const grafoLigado = useEstadoConta((estado) => estado.interruptores.grafo);
  const particulasLigadas = useEstadoConta((estado) => estado.interruptores.particulas);
  const densidade = useEstadoConta((estado) => estado.densidade);
  const preencherRascunho = useEstadoChat((estado) => estado.preencherRascunho);

  const [notas, setNotas] = useState<Nota[]>([]);
  const [arestas, setArestas] = useState<Aresta[]>([]);
  const [alturaDisponivel, setAlturaDisponivel] = useState(0);

  useEffect(() => {
    carregarOuLogar(vault.listarNotas(), setNotas, "Falha ao listar notas do vault");
    carregarOuLogar(vault.listarArestas(), setArestas, "Falha ao listar arestas do vault");
  }, [vault]);

  const nosDoGrafo = useMemo(() => montarGrafo(notas, arestas), [notas, arestas]);
  const visiveis = useMemo(() => filtrarNotas(notas, busca, noSelecionado, arestas), [notas, busca, noSelecionado, arestas]);
  const selecionada = notas.find((nota) => nota.id === noSelecionado) ?? null;

  const escopo = selecionada ? `vizinhança de '${selecionada.titulo}'` : "vault inteiro";
  const contagem = selecionada ? `${vizinhosDe(selecionada.id, arestas).length} conexões` : `${notas.length} nós`;

  return (
    <View style={{ flex: 1 }} onLayout={(evento) => setAlturaDisponivel(evento.nativeEvent.layout.height)}>
      <CampoDeGrafo
        modo="interativo"
        densidade={densidade}
        ligado={grafoLigado}
        particulasLigadas={particulasLigadas}
        pulso={pulso}
        crescer={crescer}
        nos={nosDoGrafo}
        arestas={arestas}
        noSelecionado={noSelecionado}
        aoSelecionarNo={selecionarNo}
      />

      <ChipsDeContexto escopo={escopo} contagem={contagem} />

      <FolhaDeNotas
        notas={visiveis}
        busca={busca}
        aoBuscar={definirBusca}
        noSelecionado={noSelecionado}
        aoSelecionarNota={selecionarNo}
        aoLimparSelecao={limparSelecao}
        passo={passoDaFolha}
        aoAvancarPasso={avancarPasso}
        alturaDisponivel={alturaDisponivel}
        // A rota /editor/[id] só chega na Task 14 — o cast evita que o
        // typed-routes do expo-router barre a compilação antes de ela
        // existir; tocar no botão hoje falha em navegar, como esperado.
        aoAbrirNota={() => router.push((selecionada ? `/editor/${selecionada.id}` : "/editor/nova") as Href)}
        aoPerguntar={() => {
          if (!selecionada) return;
          preencherRascunho(selecionada.titulo);
          limparSelecao();
          router.replace("/bimo");
        }}
      />
    </View>
  );
}
