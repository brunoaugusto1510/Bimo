"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { IdDeNota } from "@/lib/types";
import MarcaBimo from "./MarcaBimo";

type Props = {
  /** A nota aberta (já com título e pasta, para o cabeçalho aparecer antes do texto), ou null se o painel deve ficar fechado. */
  nota: { id: IdDeNota; titulo: string; pasta: string | null } | null;
  onFechar: () => void;
  /** Preenche o campo do chat com uma pergunta sobre esta nota e fecha o painel. */
  onPerguntar: (id: IdDeNota) => void;
};

type Estado =
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; conteudo: string };

/**
 * Painel flutuante por cima da tela — igual a um modal. Busca o conteúdo da
 * nota em /api/notas/<id> toda vez que a nota muda, porque é o servidor que
 * conhece a fonte das notas; o cliente nunca fala direto com ela.
 */
export default function LeitorDeNota({ nota, onFechar, onPerguntar }: Props) {
  const id = nota?.id ?? null;

  // "carregando" é o estado inicial de toda montagem. Quem garante que isso
  // reseta a cada nota diferente é o `key` passado lá em
  // PaginaPrincipal: ao mudar a key, o React descarta este componente e monta
  // um novo do zero — em vez de um efeito forçando o reset manualmente.
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    if (!id) return;

    let cancelado = false;

    fetch(`/api/notas/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const dados = await res.json();
        if (cancelado) return;
        if (!res.ok) {
          setEstado({ tipo: "erro", mensagem: dados.erro ?? "Erro ao carregar a nota." });
          return;
        }
        setEstado({ tipo: "pronto", conteudo: dados.nota.conteudo });
      })
      .catch(() => {
        if (!cancelado) setEstado({ tipo: "erro", mensagem: "Não consegui falar com o servidor." });
      });

    // Se o usuário trocar de nota rápido, ignora a resposta da busca anterior.
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (!nota) return null;

  const { titulo } = nota;
  // A pasta vira a "meta" acima do título, como nos cards de nota do design.
  const pasta = nota.pasta?.split("/").join(" / ") ?? "";

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-painel border border-borda bg-painel shadow-foco motion-safe:animate-entrada"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-borda px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-meta text-suave">{pasta}</span>
          {/* "Pílula Bimo" do design: atalho para levar a nota para o chat. */}
          <button
            type="button"
            onClick={() => onPerguntar(nota.id)}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-destaque-texto px-3.5 text-xs font-semibold text-destaque-texto transition-[background-color,transform] hover:bg-destaque-suave motion-safe:active:scale-[0.96]"
          >
            <MarcaBimo tamanho={14} /> Perguntar sobre esta nota
          </button>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-suave transition-[color,background-color,transform] hover:bg-painel-alt hover:text-texto motion-safe:active:scale-[0.96]"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 md:px-7">
          <h2 className="mb-4 text-titulo-nota font-semibold break-words text-balance text-destaque-texto">
            {titulo}
          </h2>

          {estado.tipo === "carregando" && <p className="text-sm text-suave">Carregando…</p>}
          {estado.tipo === "erro" && <p className="text-sm text-suave">{estado.mensagem}</p>}
          {estado.tipo === "pronto" && (
            <div className="text-corpo [&_a]:text-destaque-texto [&_a]:underline [&_code]:rounded [&_code]:bg-painel-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{estado.conteudo}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
