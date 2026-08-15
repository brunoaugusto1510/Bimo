"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  /** Caminho da nota aberta, ou null se o painel deve ficar fechado. */
  caminho: string | null;
  onFechar: () => void;
  /** Preenche o campo do chat com uma pergunta sobre esta nota e fecha o painel. */
  onPerguntar: (caminho: string) => void;
};

type Estado =
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; conteudo: string };

/**
 * Painel flutuante por cima da tela — igual a um modal. Busca o conteúdo da
 * nota em /api/notas/... toda vez que `caminho` muda, porque o servidor é
 * quem tem o GITHUB_TOKEN; o cliente nunca fala direto com o GitHub.
 */
export default function LeitorDeNota({ caminho, onFechar, onPerguntar }: Props) {
  // "carregando" é o estado inicial de toda montagem. Quem garante que isso
  // reseta a cada nota diferente é o `key={caminho}` passado lá em
  // PaginaPrincipal: ao mudar a key, o React descarta este componente e monta
  // um novo do zero — em vez de um efeito forçando o reset manualmente.
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    if (!caminho) return;

    let cancelado = false;

    fetch(`/api/notas/${caminho.split("/").map(encodeURIComponent).join("/")}`)
      .then(async (res) => {
        const dados = await res.json();
        if (cancelado) return;
        if (!res.ok) {
          setEstado({ tipo: "erro", mensagem: dados.erro ?? "Erro ao carregar a nota." });
          return;
        }
        setEstado({ tipo: "pronto", conteudo: dados.conteudo });
      })
      .catch(() => {
        if (!cancelado) setEstado({ tipo: "erro", mensagem: "Não consegui falar com o servidor." });
      });

    // Se o usuário trocar de nota rápido, ignora a resposta da busca anterior.
    return () => {
      cancelado = true;
    };
  }, [caminho]);

  if (!caminho) return null;

  const titulo = caminho.split("/").pop()!.replace(/\.md$/i, "");

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-borda bg-painel shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-borda px-4 py-3">
          <h2 className="flex-1 truncate text-sm font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={() => onPerguntar(caminho)}
            className="shrink-0 rounded-lg border border-borda px-2.5 py-1 text-xs text-suave hover:border-destaque hover:text-texto"
          >
            Perguntar sobre esta nota
          </button>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg border border-borda px-2 py-1 text-xs"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 text-sm">
          {estado.tipo === "carregando" && <p className="text-suave">Carregando…</p>}
          {estado.tipo === "erro" && <p className="text-suave">{estado.mensagem}</p>}
          {estado.tipo === "pronto" && (
            <div className="leading-relaxed [&_a]:text-destaque [&_a]:underline [&_code]:rounded [&_code]:bg-fundo [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{estado.conteudo}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
