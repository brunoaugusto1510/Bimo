"use client";

import { useState } from "react";
import BarraLateral from "@/components/BarraLateral";
import Chat from "@/components/Chat";
import { vaultExemplo } from "@/lib/vault-exemplo";

export default function Pagina() {
  // Estes dois estados moram aqui porque são compartilhados: a barra lateral
  // escreve neles e o chat lê. Estado usado por um componente só (as mensagens,
  // por exemplo) fica dentro do próprio componente.
  const [notaSelecionada, setNotaSelecionada] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  // No celular não cabem os dois painéis lado a lado, então a lista vira um menu.
  const [menuAberto, setMenuAberto] = useState(false);

  function selecionarNota({ caminho, nome }: { caminho: string; nome: string }) {
    setNotaSelecionada(caminho);
    setRascunho(`O que eu anotei em "${nome}"?`);
    setMenuAberto(false);
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
          Personal Brain
        </h1>

        {/* Espaçador para o título ficar centralizado no celular, já que o ☰ ocupa a esquerda. */}
        <span aria-hidden className="w-9 md:hidden" />
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          className={`${menuAberto ? "block" : "hidden"} w-full shrink-0 md:block md:w-64 lg:w-72`}
        >
          <BarraLateral
            itens={vaultExemplo}
            notaSelecionada={notaSelecionada}
            onSelecionarNota={selecionarNota}
          />
        </div>

        {/* min-w-0 impede que uma mensagem longa estique este painel e quebre o layout. */}
        <div className={`${menuAberto ? "hidden" : "block"} min-w-0 flex-1 md:block`}>
          <Chat rascunho={rascunho} onRascunhoChange={setRascunho} />
        </div>
      </div>
    </div>
  );
}
