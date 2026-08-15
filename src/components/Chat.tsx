"use client";

import { useEffect, useRef, useState } from "react";
import Mensagem from "./Mensagem";
import type { Mensagem as TipoMensagem } from "@/lib/types";

type Props = {
  /** O texto do campo vive no componente pai, porque clicar numa nota da barra lateral também escreve nele. */
  rascunho: string;
  onRascunhoChange: (texto: string) => void;
  /** Chamado toda vez que uma resposta do agente chega — o grafo de fundo usa isso para "reagir". */
  onRespostaAgente?: () => void;
};

const SUGESTOES = [
  "O que eu sei sobre normalização de banco de dados?",
  "Resuma minhas anotações de redes",
  "Quais notas eu tenho sobre React?",
  "Aonde paramos sobre aquele assunto de ontem?",
];

export default function Chat({ rascunho, onRascunhoChange, onRespostaAgente }: Props) {
  const [mensagens, setMensagens] = useState<TipoMensagem[]>([]);
  const [pensando, setPensando] = useState(false);

  const fimDaLista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // Rolar para o fim sempre que chegar mensagem nova ou o "..." aparecer.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, pensando]);

  // O textarea cresce junto com o texto, até um limite.
  useEffect(() => {
    const elemento = campo.current;
    if (!elemento) return;
    elemento.style.height = "auto";
    elemento.style.height = `${Math.min(elemento.scrollHeight, 160)}px`;
  }, [rascunho]);

  function enviar() {
    const texto = rascunho.trim();
    if (!texto || pensando) return;

    const doUsuario: TipoMensagem = {
      id: crypto.randomUUID(),
      papel: "usuario",
      conteudo: texto,
    };

    setMensagens((anteriores) => [...anteriores, doUsuario]);
    onRascunhoChange("");
    setPensando(true);

    // Resposta de mentira. Na próxima etapa, este trecho vira uma chamada
    // para /api/chat — o resto do componente continua igual.
    setTimeout(() => {
      setMensagens((anteriores) => [
        ...anteriores,
        {
          id: crypto.randomUUID(),
          papel: "agente",
          conteudo:
            "Ainda **não estou conectado** ao Gemini nem ao seu vault de verdade — " +
            "esta etapa é só a interface.\n\nO que já funciona aqui:\n\n" +
            "- a árvore de pastas da esquerda (com dados de exemplo)\n" +
            "- clicar numa nota para começar uma pergunta sobre ela\n" +
            "- o histórico da conversa e o campo de mensagem\n\n" +
            "Na próxima etapa, esta resposta passa a vir do modelo lendo as suas notas.",
        },
      ]);
      setPensando(false);
      onRespostaAgente?.();
    }, 700);
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha — como na maioria dos chats.
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      enviar();
    }
  }

  return (
    // Sem cor de fundo sólida aqui: é essa transparência que deixa o
    // GrafoDeFundo (renderizado atrás, no PaginaPrincipal) aparecer por trás
    // das mensagens. As bolhas de mensagem continuam opacas — só o "vazio"
    // ao redor delas mostra o grafo.
    <section className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {mensagens.length === 0 ? (
            <EstadoVazio onEscolher={onRascunhoChange} />
          ) : (
            mensagens.map((mensagem) => (
              <Mensagem key={mensagem.id} mensagem={mensagem} />
            ))
          )}

          {pensando && <Digitando />}

          {/* Âncora invisível: é para cá que a rolagem automática vai. */}
          <div ref={fimDaLista} />
        </div>
      </div>

      <div className="border-t border-borda bg-painel/90 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={campo}
            rows={1}
            value={rascunho}
            onChange={(evento) => onRascunhoChange(evento.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Digite sua mensagem..."
            className="flex-1 resize-none rounded-xl border border-borda bg-fundo px-3.5 py-2.5 text-sm outline-none placeholder:text-suave focus:border-destaque"
          />

          <button
            type="button"
            onClick={enviar}
            disabled={rascunho.trim() === "" || pensando}
            className="h-10 shrink-0 rounded-xl bg-destaque px-4 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enviar
          </button>
        </div>

        <p className="mx-auto mt-2 max-w-2xl px-1 text-xs text-suave">
          Enter envia · Shift + Enter quebra linha
        </p>
      </div>
    </section>
  );
}

function EstadoVazio({ onEscolher }: { onEscolher: (texto: string) => void }) {
  return (
    <div className="mt-10 text-center">
      <h2 className="text-lg font-semibold">Converse com as suas notas</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-suave">
        Pergunte qualquer coisa sobre o que você já estudou, ou clique numa nota
        na barra lateral para começar.
      </p>

      <div className="mt-6 flex flex-col items-center gap-2">
        {SUGESTOES.map((sugestao) => (
          <button
            key={sugestao}
            type="button"
            onClick={() => onEscolher(sugestao)}
            className="w-full max-w-md rounded-xl border border-borda bg-painel px-4 py-2.5 text-left text-sm text-suave transition-colors hover:border-destaque hover:text-texto"
          >
            {sugestao}
          </button>
        ))}
      </div>
    </div>
  );
}

function Digitando() {
  return (
    <div className="flex items-center gap-1.5 px-1 text-suave">
      {[0, 150, 300].map((atraso) => (
        <span
          key={atraso}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${atraso}ms` }}
        />
      ))}
    </div>
  );
}
