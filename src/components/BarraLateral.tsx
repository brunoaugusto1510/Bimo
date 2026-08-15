"use client";

import { useState } from "react";
import type { ItemVault } from "@/lib/types";

type Props = {
  itens: ItemVault[];
  /** Caminho da nota atualmente destacada, ou null se nenhuma */
  notaSelecionada: string | null;
  onSelecionarNota: (nota: { caminho: string; nome: string }) => void;
};

export default function BarraLateral({ itens, notaSelecionada, onSelecionarNota }: Props) {
  const totalDeNotas = contarNotas(itens);

  return (
    <aside className="flex h-full flex-col border-r border-borda bg-painel">
      <div className="border-b border-borda px-4 py-3">
        <h2 className="text-sm font-semibold">Seu Vault</h2>
        <p className="mt-0.5 text-xs text-suave">
          {totalDeNotas} notas · dados de exemplo
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {itens.map((item) => (
          <ItemDaArvore
            key={chaveDoItem(item)}
            item={item}
            nivel={0}
            notaSelecionada={notaSelecionada}
            onSelecionarNota={onSelecionarNota}
          />
        ))}
      </nav>
    </aside>
  );
}

/**
 * Um item da árvore, que desenha a si mesmo e — se for pasta — desenha os
 * filhos chamando este mesmo componente. É recursão: o mesmo código serve
 * para qualquer profundidade de pastas, sem precisar saber quantas existem.
 */
function ItemDaArvore({
  item,
  nivel,
  notaSelecionada,
  onSelecionarNota,
}: {
  item: ItemVault;
  nivel: number;
  notaSelecionada: string | null;
  onSelecionarNota: Props["onSelecionarNota"];
}) {
  // Pastas de primeiro nível começam abertas; as de dentro, fechadas.
  const [aberta, setAberta] = useState(nivel === 0);

  // Cada nível entra 12px para a direita. Vai no `style` porque o Tailwind
  // não consegue gerar classes a partir de um valor calculado em runtime.
  const recuo = { paddingLeft: `${nivel * 12 + 8}px` };

  if (item.tipo === "nota") {
    const selecionada = notaSelecionada === item.caminho;

    return (
      <button
        type="button"
        style={recuo}
        onClick={() => onSelecionarNota({ caminho: item.caminho, nome: item.nome })}
        className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors ${
          selecionada
            ? "bg-destaque-suave font-medium text-destaque"
            : "text-suave hover:bg-destaque-suave/60 hover:text-texto"
        }`}
      >
        <span aria-hidden className="shrink-0 opacity-70">
          📄
        </span>
        <span className="truncate">{item.nome}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        style={recuo}
        onClick={() => setAberta((estava) => !estava)}
        aria-expanded={aberta}
        className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm font-medium transition-colors hover:bg-destaque-suave/60"
      >
        <span aria-hidden className="w-3 shrink-0 text-xs text-suave">
          {aberta ? "▾" : "▸"}
        </span>
        <span aria-hidden className="shrink-0">
          {aberta ? "📂" : "📁"}
        </span>
        <span className="truncate">{item.nome}</span>
      </button>

      {aberta && (
        <div>
          {item.filhos.map((filho) => (
            <ItemDaArvore
              key={chaveDoItem(filho)}
              item={filho}
              nivel={nivel + 1}
              notaSelecionada={notaSelecionada}
              onSelecionarNota={onSelecionarNota}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** O React precisa de uma chave estável por item de lista. */
function chaveDoItem(item: ItemVault): string {
  return item.tipo === "nota" ? item.caminho : `pasta:${item.nome}`;
}

function contarNotas(itens: ItemVault[]): number {
  return itens.reduce(
    (total, item) =>
      total + (item.tipo === "nota" ? 1 : contarNotas(item.filhos)),
    0,
  );
}
