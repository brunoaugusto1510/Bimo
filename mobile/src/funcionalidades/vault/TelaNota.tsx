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
  // Seletores pontuais em vez de assinar o store inteiro: o campo de grafo
  // roda a 120fps e não deve re-renderizar por mudança de busca ou de altura.
  const busca = useEstadoVault((estado) => estado.busca);
  const noSelecionado = useEstadoVault((estado) => estado.noSelecionado);
  const alturaDaFolha = useEstadoVault((estado) => estado.alturaDaFolha);
  const alturaMinima = useEstadoVault((estado) => estado.alturaMinima);
  const alturaMaxima = useEstadoVault((estado) => estado.alturaMaxima);
  const definirBusca = useEstadoVault((estado) => estado.definirBusca);
  const selecionarNo = useEstadoVault((estado) => estado.selecionarNo);
  const limparSelecao = useEstadoVault((estado) => estado.limparSelecao);
  const definirAlturaDaFolha = useEstadoVault((estado) => estado.definirAlturaDaFolha);
  const definirLimitesDaFolha = useEstadoVault((estado) => estado.definirLimitesDaFolha);
  const pulso = useEstadoGrafo((estado) => estado.pulso);
  const crescer = useEstadoGrafo((estado) => estado.crescer);
  const grafoLigado = useEstadoConta((estado) => estado.interruptores.grafo);
  const particulasLigadas = useEstadoConta((estado) => estado.interruptores.particulas);
  const densidade = useEstadoConta((estado) => estado.densidade);
  const preencherRascunho = useEstadoChat((estado) => estado.preencherRascunho);

  const [notas, setNotas] = useState<Nota[]>([]);
  const [arestas, setArestas] = useState<Aresta[]>([]);
  const [alturaDisponivel, setAlturaDisponivel] = useState(0);
  // Alça + rodapé medidos pela própria folha: é o mínimo até onde ela recolhe.
  const [minimoDaFolha, setMinimoDaFolha] = useState(0);

  // A altura da tela é o máximo — a bandeja em tela cheia.
  useEffect(() => {
    if (alturaDisponivel > 0 && minimoDaFolha > 0) definirLimitesDaFolha(minimoDaFolha, alturaDisponivel);
  }, [alturaDisponivel, minimoDaFolha, definirLimitesDaFolha]);

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
        altura={alturaDaFolha}
        alturaMinima={alturaMinima}
        alturaMaxima={alturaMaxima}
        aoArrastar={definirAlturaDaFolha}
        aoMedirMinimo={setMinimoDaFolha}
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
