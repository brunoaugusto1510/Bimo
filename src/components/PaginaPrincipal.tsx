"use client";

import { useState } from "react";
import BarraLateral from "@/components/BarraLateral";
import Chat from "@/components/Chat";
import GrafoDeFundo from "@/components/GrafoDeFundo";
import LeitorDeNota from "@/components/LeitorDeNota";
import type { Grafo } from "@/lib/grafo";
import type { ItemVault } from "@/lib/types";

type Props = {
  /** Já vem pronto do servidor — este componente só cuida da interatividade. */
  itens: ItemVault[];
  grafo: Grafo;
  aviso?: string;
};

export default function PaginaPrincipal({ itens, grafo, aviso }: Props) {
  // Caminho da nota aberta no painel de leitura — também é o que fica
  // destacado na barra lateral e no grafo, então um estado só serve aos dois.
  const [notaAberta, setNotaAberta] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  // No celular não cabem os dois painéis lado a lado, então a lista vira um menu.
  const [menuAberto, setMenuAberto] = useState(false);

  // Incrementar isto é o sinal para o grafo dar um pulso de movimento —
  // acontece na resposta falsa de hoje e vai continuar acontecendo quando a
  // Etapa 4 trocar isso pela resposta de verdade do Gemini.
  const [pulsoDoGrafo, setPulsoDoGrafo] = useState(0);

  function abrirNota(caminho: string) {
    setNotaAberta(caminho);
    setMenuAberto(false);
  }

  function perguntarSobreNota(caminho: string) {
    const nome = caminho.split("/").pop()!.replace(/\.md$/i, "");
    setRascunho(`O que eu anotei em "${nome}"?`);
    setNotaAberta(null);
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
      <header className="flex shrink-0 items-center gap-3 border-b border-borda bg-painel px-4 py-3">
        <button
          type="button"
          onClick={() => setMenuAberto((estava) => !estava)}
          aria-label="Mostrar ou esconder o vault"
          className="rounded-lg border border-borda px-2.5 py-1 text-sm md:hidden"
        >
          ☰
        </button>

        <h1 className="flex-1 text-center text-base font-semibold tracking-tight md:text-left">
          Bimo
        </h1>

        {/* Fica à direita do título, equilibrando o ☰ da esquerda para o título
            seguir centralizado no celular — por isso o rótulo curto no mobile. */}
        <button
          type="button"
          onClick={sair}
          aria-label="Sair"
          className="rounded-lg border border-borda px-2.5 py-1 text-sm"
        >
          <span aria-hidden className="md:hidden">
            ⏻
          </span>
          <span className="hidden md:inline">Sair</span>
        </button>
      </header>

      {(aviso || grafo.aviso) && (
        <p className="shrink-0 border-b border-borda bg-destaque-suave px-4 py-1.5 text-center text-xs text-suave">
          {aviso ?? grafo.aviso}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          className={`${menuAberto ? "block" : "hidden"} w-full shrink-0 md:block md:w-64 lg:w-72`}
        >
          <BarraLateral
            itens={itens}
            notaSelecionada={notaAberta}
            onSelecionarNota={(nota) => abrirNota(nota.caminho)}
          />
        </div>

        {/* relative: é a referência de posicionamento do GrafoDeFundo, que usa "absolute inset-0". */}
        {/* min-w-0 impede que uma mensagem longa estique este painel e quebre o layout. */}
        <div className={`${menuAberto ? "hidden" : "block"} relative min-w-0 flex-1 md:block`}>
          <GrafoDeFundo
            nos={grafo.nos}
            arestas={grafo.arestas}
            notaAberta={notaAberta}
            pulso={pulsoDoGrafo}
            onAbrirNota={abrirNota}
          />
          <div className="relative h-full">
            <Chat
              rascunho={rascunho}
              onRascunhoChange={setRascunho}
              onRespostaAgente={() => setPulsoDoGrafo((n) => n + 1)}
            />
          </div>
        </div>
      </div>

      <LeitorDeNota
        key={notaAberta ?? "fechado"}
        caminho={notaAberta}
        onFechar={() => setNotaAberta(null)}
        onPerguntar={perguntarSobreNota}
      />
    </div>
  );
}
