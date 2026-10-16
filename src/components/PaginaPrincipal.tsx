"use client";

import { useMemo, useRef, useState } from "react";
import AlternadorDeTema from "@/components/AlternadorDeTema";
import BarraDoGrafo from "@/components/BarraDoGrafo";
import BarraLateral from "@/components/BarraLateral";
import CartaoDeFoco from "@/components/CartaoDeFoco";
import Chat from "@/components/Chat";
import GrafoDeFundo, { type ControleDoGrafo } from "@/components/GrafoDeFundo";
import LeitorDeNota from "@/components/LeitorDeNota";
import MarcaBimo from "@/components/MarcaBimo";
import SeletorPill from "@/components/SeletorPill";
import { grupoDaPasta } from "@/lib/caminho-da-nota";
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
 * Notas: o grafo vira a tela — dá para arrastar, dar zoom e clicar nas notas.
 */
type Modo = "bimo" | "notas";

const OPCOES_DE_MODO = [
  { valor: "bimo", rotulo: "Bimo" },
  { valor: "notas", rotulo: "Notas" },
] as const;

type DadosDaNota = { id: IdDeNota; titulo: string; pasta: string | null };

/** Achata a árvore num mapa por id: título e pasta de qualquer nota, estando ela no grafo ou não. */
function indexarNotas(itens: readonly ItemDeNotas[], mapa = new Map<IdDeNota, DadosDaNota>()) {
  for (const item of itens) {
    if (item.tipo === "nota") mapa.set(item.id, { id: item.id, titulo: item.nome, pasta: item.pasta });
    else indexarNotas(item.filhos, mapa);
  }
  return mapa;
}

export default function PaginaPrincipal({ itens, grafo, aviso }: Props) {
  const [modo, setModo] = useState<Modo>("bimo");
  // Id da nota aberta no painel de leitura — também é o que fica
  // destacado na barra lateral e no grafo (no modo fundo), então um estado só serve aos dois.
  const [notaAberta, setNotaAberta] = useState<IdDeNota | null>(null);
  // Nota selecionada no grafo da aba Notas — a que ganha o cartão de foco. É
  // separada da aberta: selecionar é "olhar", abrir é "ler".
  const [notaFocada, setNotaFocada] = useState<IdDeNota | null>(null);
  // Cada escolha na barra lateral pede à câmera que vá até a nota — inclusive de
  // novo, se ela já era a selecionada (ver `focoPedido` no GrafoDeFundo).
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const [rascunho, setRascunho] = useState("");

  // No celular não cabem os dois painéis lado a lado, então a lista vira um menu.
  const [menuAberto, setMenuAberto] = useState(false);

  // Incrementar isto é o sinal para o grafo dar um pulso de movimento —
  // acontece na resposta falsa de hoje e vai continuar acontecendo quando a
  // Etapa 4 trocar isso pela resposta de verdade do Gemini.
  const [pulsoDoGrafo, setPulsoDoGrafo] = useState(0);

  const controleDoGrafo = useRef<ControleDoGrafo>(null);

  const emNotas = modo === "notas";
  const graus = useMemo(() => calcularGraus(grafo.arestas), [grafo.arestas]);
  const notasPorId = useMemo(() => indexarNotas(itens), [itens]);
  const dadosDaNotaFocada = notaFocada ? notasPorId.get(notaFocada) : undefined;

  function mudarModo(novo: Modo) {
    setModo(novo);
    setMenuAberto(false);
  }

  function abrirNota(id: IdDeNota) {
    setNotaAberta(id);
    setMenuAberto(false);
  }

  /** Na aba Notas a barra lateral serve para achar a nota no grafo; na aba Bimo, para ler. */
  function escolherNoMenu(id: IdDeNota) {
    if (emNotas) {
      setNotaFocada(id);
      setPedidoDeFoco((n) => n + 1);
      setMenuAberto(false);
      return;
    }
    abrirNota(id);
  }

  function perguntarSobreNota(id: IdDeNota) {
    setRascunho(`O que eu anotei em "${notasPorId.get(id)?.titulo ?? "esta nota"}"?`);
    setNotaAberta(null);
    mudarModo("bimo");
  }

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
            notaSelecionada={emNotas ? notaFocada : notaAberta}
            onSelecionarNota={(nota) => escolherNoMenu(nota.id)}
          />
        </div>

        {/* relative: é a referência de posicionamento do GrafoDeFundo, que usa "absolute inset-0". */}
        {/* min-w-0 impede que uma mensagem longa estique este painel e quebre o layout. */}
        <div className={`${menuAberto ? "hidden" : "block"} relative min-w-0 flex-1 md:block`}>
          <GrafoDeFundo
            nos={grafo.nos}
            arestas={grafo.arestas}
            configuracao={grafo.configuracao}
            notaAberta={notaAberta}
            pulso={pulsoDoGrafo}
            onAbrirNota={abrirNota}
            interativo={emNotas}
            selecionado={notaFocada}
            onSelecionar={setNotaFocada}
            focoPedido={pedidoDeFoco}
            controleRef={controleDoGrafo}
          />

          {/* O chat fica montado mesmo na aba Notas (só escondido): a conversa vive no estado dele. */}
          <div className="relative h-full" hidden={emNotas}>
            <Chat
              ativo={!emNotas}
              rascunho={rascunho}
              onRascunhoChange={setRascunho}
              onRespostaAgente={() => setPulsoDoGrafo((n) => n + 1)}
            />
          </div>

          {emNotas && (
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
                    onPerguntar={() => perguntarSobreNota(notaFocada)}
                    onFechar={() => setNotaFocada(null)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <LeitorDeNota
        key={notaAberta ?? "fechado"}
        nota={notaAberta ? (notasPorId.get(notaAberta) ?? null) : null}
        onFechar={() => setNotaAberta(null)}
        onPerguntar={perguntarSobreNota}
      />
    </div>
  );
}
