"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AlternadorDeTema from "@/components/AlternadorDeTema";
import BarraDoGrafo from "@/components/BarraDoGrafo";
import BarraLateral from "@/components/BarraLateral";
import CartaoDeFoco from "@/components/CartaoDeFoco";
import Chat from "@/components/Chat";
import EspacoDeTrabalho from "@/components/EspacoDeTrabalho";
import GrafoDeFundo, { type ControleDoGrafo } from "@/components/GrafoDeFundo";
import MarcaBimo from "@/components/MarcaBimo";
import PaletaIrParaNota from "@/components/PaletaIrParaNota";
import SeletorPill from "@/components/SeletorPill";
import { indexarNotas } from "@/lib/arvore-de-notas";
import { combinaAtalho } from "@/lib/atalhos";
import { grupoDaPasta } from "@/lib/caminho-da-nota";
import { ABA_DO_GRAFICO, abaAtiva, idAtual } from "@/lib/espaco-de-trabalho/estado";
import { useEspacoDeTrabalho } from "@/lib/espaco-de-trabalho/usar-espaco-de-trabalho";
import { calcularGraus } from "@/lib/fisica-do-grafo";
import type { Grafo } from "@/lib/grafo-de-notas";
import type { IdDeNota, ItemDeNotas } from "@/lib/types";

type Props = {
  /** Já vem pronto do servidor — este componente só cuida da interatividade. */
  itens: ItemDeNotas[];
  grafo: Grafo;
  aviso?: string;
};

/**
 * Bimo: conversa com o agente, com o grafo só de pano de fundo.
 * Notas: o espaço de trabalho — abas (o Gráfico, que dá para arrastar, aproximar e clicar,
 * mais as notas abertas), a paleta Ctrl+O e o painel lateral de cada nota.
 */
type Modo = "bimo" | "notas";

const OPCOES_DE_MODO = [
  { valor: "bimo", rotulo: "Bimo" },
  { valor: "notas", rotulo: "Notas" },
] as const;

export default function PaginaPrincipal({ itens, grafo, aviso }: Props) {
  const [modo, setModo] = useState<Modo>("bimo");
  // Nota selecionada no grafo da aba Gráfico — a que ganha o cartão de foco. É
  // separada da aberta: selecionar é "olhar", abrir é "ler".
  const [notaFocada, setNotaFocada] = useState<IdDeNota | null>(null);
  // Cada escolha na barra lateral pede à câmera que vá até a nota — inclusive de
  // novo, se ela já era a selecionada (ver `focoPedido` no GrafoDeFundo).
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const [rascunho, setRascunho] = useState("");
  const [paletaAberta, setPaletaAberta] = useState(false);

  // No celular não cabem os dois painéis lado a lado, então a lista vira um menu.
  const [menuAberto, setMenuAberto] = useState(false);

  // Incrementar isto é o sinal para o grafo dar um pulso de movimento — acontece a cada
  // resposta do agente.
  const [pulsoDoGrafo, setPulsoDoGrafo] = useState(0);

  const controleDoGrafo = useRef<ControleDoGrafo>(null);

  const emNotas = modo === "notas";
  const graus = useMemo(() => calcularGraus(grafo.arestas), [grafo.arestas]);
  const notasPorId = useMemo(() => indexarNotas(itens), [itens]);
  const idsExistentes = useMemo(() => new Set(notasPorId.keys()), [notasPorId]);
  const { estado, despachar } = useEspacoDeTrabalho(idsExistentes);

  const aba = abaAtiva(estado);
  const noGrafico = estado.ativa === ABA_DO_GRAFICO;
  const idDaNotaAberta = aba?.tipo === "nota" ? idAtual(aba) : null;
  const dadosDaNotaFocada = notaFocada ? notasPorId.get(notaFocada) : undefined;

  function mudarModo(novo: Modo) {
    setModo(novo);
    setMenuAberto(false);
  }

  /** Abrir uma nota leva ao modo Notas (a nota vive lá) e fecha o que estiver aberto por cima. */
  function abrirNota(id: IdDeNota, opcoes: { novaAba: boolean } = { novaAba: false }) {
    despachar({ tipo: "abrir-nota", id, novaAba: opcoes.novaAba });
    setModo("notas");
    setMenuAberto(false);
    setPaletaAberta(false);
  }

  /** No Gráfico a barra lateral serve para achar a nota no grafo; nas demais abas e no modo Bimo, para abri-la. */
  function escolherNoMenu(id: IdDeNota) {
    if (emNotas && noGrafico) {
      setNotaFocada(id);
      setPedidoDeFoco((n) => n + 1);
      setMenuAberto(false);
      return;
    }
    abrirNota(id);
  }

  function perguntarAoBimo(id: IdDeNota | null) {
    setRascunho(id ? `O que eu anotei em "${notasPorId.get(id)?.titulo ?? "esta nota"}"?` : "");
    mudarModo("bimo");
  }

  // Atalhos que valem em qualquer lugar da página (inclusive com o foco num campo de texto).
  // Os escritos como funções novas a cada render leem sempre o estado de agora.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (combinaAtalho(evento, "mod+o")) {
        evento.preventDefault();
        setPaletaAberta(true);
      } else if (combinaAtalho(evento, "mod+g")) {
        evento.preventDefault();
        despachar({ tipo: "ativar-aba", chave: ABA_DO_GRAFICO });
        setModo("notas");
      } else if (combinaAtalho(evento, "mod+j")) {
        evento.preventDefault();
        setModo("bimo");
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [despachar]);

  /**
   * Sair de verdade: a rota apaga o cookie e recarregamos a página inteira.
   * `window.location` em vez do router do Next porque a home é server
   * component — uma navegação client-side manteria a árvore atual na tela.
   */
  async function sair() {
    await fetch("/api/logout", { method: "POST" });
    window.location.replace("/login");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Três colunas, a do meio auto: o seletor fica no centro de verdade, não "no que sobrar". */}
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-borda bg-painel px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuAberto((estava) => !estava)}
            aria-label="Mostrar ou esconder as notas"
            className="flex h-10 w-10 items-center justify-center rounded-full text-suave transition-[color,background-color,transform] hover:bg-painel-alt hover:text-texto motion-safe:active:scale-[0.96] md:hidden"
          >
            ☰
          </button>

          <h1 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <MarcaBimo tamanho={24} />
            <span className="sr-only md:not-sr-only">Bimo</span>
          </h1>
        </div>

        <SeletorPill
          rotulo="Modo de visualização"
          opcoes={OPCOES_DE_MODO}
          valor={modo}
          onChange={mudarModo}
        />

        <div className="flex items-center gap-2 justify-self-end">
          <AlternadorDeTema />
          <button
            type="button"
            onClick={sair}
            aria-label="Sair"
            className="flex h-10 min-w-10 items-center justify-center rounded-full border border-borda bg-painel px-2.5 text-sm font-semibold transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96] md:px-4"
          >
            <span aria-hidden className="md:hidden">
              ⏻
            </span>
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>
      </header>

      {(aviso || grafo.aviso) && (
        <p className="shrink-0 border-b border-destaque-suave-borda bg-destaque-suave px-4 py-1.5 text-center text-xs text-destaque-texto">
          {aviso ?? grafo.aviso}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          className={`${menuAberto ? "block" : "hidden"} w-full shrink-0 md:block md:w-64 lg:w-72`}
        >
          <BarraLateral
            itens={itens}
            notaSelecionada={emNotas && noGrafico ? notaFocada : idDaNotaAberta}
            onSelecionarNota={(nota) => escolherNoMenu(nota.id)}
          />
        </div>

        {/* min-w-0 impede que uma mensagem longa estique este painel e quebre o layout. */}
        <div className={`${menuAberto ? "hidden" : "flex"} min-w-0 flex-1 flex-col md:flex`}>
          <EspacoDeTrabalho
            ativo={emNotas}
            estado={estado}
            despachar={despachar}
            notas={notasPorId}
            conexoesPorNota={graus}
            totais={{ notas: notasPorId.size, conexoes: grafo.arestas.length }}
            aoAbrirNota={abrirNota}
            aoCriarNota={() => {}}
            aoPerguntarAoBimo={perguntarAoBimo}
            aoIrParaNota={() => setPaletaAberta(true)}
          >
            <GrafoDeFundo
              nos={grafo.nos}
              arestas={grafo.arestas}
              configuracao={grafo.configuracao}
              notaAberta={idDaNotaAberta}
              pulso={pulsoDoGrafo}
              onAbrirNota={abrirNota}
              interativo={emNotas}
              pausado={emNotas && !noGrafico}
              selecionado={notaFocada}
              onSelecionar={setNotaFocada}
              focoPedido={pedidoDeFoco}
              controleRef={controleDoGrafo}
            />

            {/* O chat fica montado mesmo no modo Notas (só escondido): a conversa vive no estado dele. */}
            <div className="relative h-full" hidden={emNotas}>
              <Chat
                ativo={!emNotas}
                rascunho={rascunho}
                onRascunhoChange={setRascunho}
                onRespostaAgente={() => setPulsoDoGrafo((n) => n + 1)}
              />
            </div>

            {emNotas && noGrafico && (
              // O contêiner não recebe toque (`pointer-events-none`): só a barra e o cartão
              // recebem — o resto é grafo, que precisa de todo o arrasto.
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
                <BarraDoGrafo
                  nos={grafo.nos.length}
                  conexoes={grafo.arestas.length}
                  onAproximar={() => controleDoGrafo.current?.aproximar()}
                  onAfastar={() => controleDoGrafo.current?.afastar()}
                  onEnquadrar={() => controleDoGrafo.current?.enquadrar()}
                />

                {notaFocada && dadosDaNotaFocada && (
                  <div className="flex justify-center p-3 md:justify-start md:p-4">
                    <CartaoDeFoco
                      titulo={dadosDaNotaFocada.titulo}
                      pasta={grupoDaPasta(dadosDaNotaFocada.pasta)}
                      conexoes={graus.get(notaFocada) ?? 0}
                      onAbrir={() => abrirNota(notaFocada)}
                      onVizinhos={() => controleDoGrafo.current?.enquadrarVizinhos()}
                      onPerguntar={() => perguntarAoBimo(notaFocada)}
                      onFechar={() => setNotaFocada(null)}
                    />
                  </div>
                )}
              </div>
            )}
          </EspacoDeTrabalho>
        </div>
      </div>

      <PaletaIrParaNota
        aberta={paletaAberta}
        notas={[...notasPorId.values()]}
        recentes={estado.recentes}
        // Criar notas chega com a edição (Fase 8b).
        podeCriar={false}
        pastaDaCriacao={idDaNotaAberta ? (notasPorId.get(idDaNotaAberta)?.pasta ?? null) : null}
        aoFechar={() => setPaletaAberta(false)}
        aoAbrir={abrirNota}
        aoCriar={() => {}}
      />
    </div>
  );
}
