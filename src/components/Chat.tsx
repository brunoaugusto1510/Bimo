"use client";

import { useEffect, useRef, useState } from "react";
import BimoPensando from "./BimoPensando";
import MarcaBimo from "./MarcaBimo";
import Mensagem, { AssinaturaDoBimo } from "./Mensagem";
import type { Mensagem as TipoMensagem } from "@/lib/types";

type Props = {
  /** O texto do campo vive no componente pai, porque clicar numa nota da barra lateral também escreve nele. */
  rascunho: string;
  onRascunhoChange: (texto: string) => void;
  /** Chamado toda vez que uma resposta do agente chega — o grafo de fundo usa isso para "reagir". */
  onRespostaAgente?: () => void;
  /**
   * Falso quando o chat está montado mas escondido (aba Notas). Escondido, o
   * navegador não faz layout dele: rolar não faz nada e o `scrollHeight` do
   * campo vem 0 — então rolagem e altura esperam o chat voltar a aparecer.
   */
  ativo?: boolean;
};

/** Até aqui o campo cresce com o texto; depois disso ele rola por dentro. */
const ALTURA_MAXIMA_DO_CAMPO = 160;

const SUGESTOES = [
  "O que eu sei sobre normalização de banco de dados?",
  "Resuma minhas anotações de redes",
  "Quais notas eu tenho sobre React?",
  "Aonde paramos sobre aquele assunto de ontem?",
];

export default function Chat({ rascunho, onRascunhoChange, onRespostaAgente, ativo = true }: Props) {
  const [mensagens, setMensagens] = useState<TipoMensagem[]>([]);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fimDaLista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  // Rolar para o fim sempre que chegar mensagem nova ou o "..." aparecer — e
  // ao voltar de escondido, quando o que chegou nesse meio-tempo ficou fora da vista.
  useEffect(() => {
    if (!ativo) return;
    // `nearest`: rola só a lista do chat, nunca a página inteira.
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensagens, pensando, ativo]);

  // O textarea cresce junto com o texto, até um limite.
  useEffect(() => {
    const elemento = campo.current;
    if (!ativo || !elemento) return;
    elemento.style.height = "auto";
    // `scrollHeight` não conta a borda, mas o campo é `border-box`: sem somá-la ele
    // fica 2px menor que o texto e o navegador mostra uma barra de rolagem à toa.
    const bordas = elemento.offsetHeight - elemento.clientHeight;
    const altura = elemento.scrollHeight + bordas;
    elemento.style.height = `${Math.min(altura, ALTURA_MAXIMA_DO_CAMPO)}px`;
    // A barra só aparece quando o texto realmente passa do limite.
    elemento.style.overflowY = altura > ALTURA_MAXIMA_DO_CAMPO ? "auto" : "hidden";
  }, [rascunho, ativo]);

  async function enviar() {
    const texto = rascunho.trim();
    if (!texto || pensando) return;

    const doUsuario: TipoMensagem = {
      id: crypto.randomUUID(),
      papel: "usuario",
      conteudo: texto,
    };

    // Guardamos o histórico completo (incluindo a mensagem que acabou de
    // entrar) para mandar pro agente — ele precisa da conversa toda, não só
    // da última pergunta.
    const historico = [...mensagens, doUsuario];

    setMensagens(historico);
    onRascunhoChange("");
    setPensando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagens: historico.map((m) => ({ papel: m.papel, conteudo: m.conteudo })),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro || "O agente não conseguiu responder.");
      }

      setMensagens((anteriores) => [
        ...anteriores,
        {
          id: crypto.randomUUID(),
          papel: "agente",
          conteudo: dados.resposta as string,
          ferramentas: dados.ferramentas as TipoMensagem["ferramentas"],
        },
      ]);
      onRespostaAgente?.();
      for (const ferramenta of (dados.ferramentas ?? []) as NonNullable<TipoMensagem["ferramentas"]>) {
        if (!ferramenta.erro && ferramenta.notaId && ["criar_nota", "editar_nota"].includes(ferramenta.nome)) {
          window.dispatchEvent(new CustomEvent("bimo:nota-alterada-pelo-agente", { detail: { id: ferramenta.notaId } }));
        }
      }
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não consegui falar com o agente. Tente de novo.",
      );
    } finally {
      setPensando(false);
    }
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
      {/* `relative`: o rótulo `sr-only` de cada mensagem é absoluto — sem um ancestral
          posicionado aqui, ele escapa do recorte do scroll e alonga o documento. */}
      <div className="relative flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {mensagens.length === 0 ? (
            <EstadoVazio onEscolher={onRascunhoChange} />
          ) : (
            mensagens.map((mensagem) => (
              <Mensagem key={mensagem.id} mensagem={mensagem} />
            ))
          )}

          {pensando && <Pensando />}

          {/* Âncora invisível: é para cá que a rolagem automática vai. */}
          <div ref={fimDaLista} />
        </div>
      </div>

      <div className="border-t border-borda bg-painel/90 px-4 py-3 backdrop-blur-sm">
        {erro && (
          <div className="mx-auto mb-2 max-w-2xl rounded-lg bg-erro-suave px-3 py-2 text-xs text-erro">
            {erro}
          </div>
        )}

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

          {/* Botão primário do design system: pílula roxa; desabilitado vira cinza quente. */}
          <button
            type="button"
            onClick={enviar}
            disabled={rascunho.trim() === "" || pensando}
            className="h-10 shrink-0 rounded-full bg-destaque px-5 text-sm font-semibold text-sobre-destaque transition-[background-color,transform] hover:bg-destaque-hover disabled:cursor-not-allowed disabled:bg-desabilitado disabled:text-desabilitado-texto motion-safe:enabled:active:scale-[0.96]"
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
      <div className="flex justify-center">
        <MarcaBimo tamanho={48} />
      </div>
      <h2 className="mt-3 text-lg font-semibold text-balance">Converse com as suas notas</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-suave">
        Pergunte qualquer coisa sobre o que você já estudou, ou clique numa nota
        na barra lateral para começar.
      </p>

      <div className="mt-6 flex flex-col items-center gap-2">
        {SUGESTOES.map((sugestao) => (
          <button
            key={sugestao}
            type="button"
            onClick={() => onEscolher(sugestao)}
            className="w-full max-w-md rounded-xl border border-borda bg-painel px-4 py-2.5 text-left text-sm text-pretty text-suave transition-[color,background-color,border-color,transform] hover:border-destaque-suave-borda hover:bg-destaque-suave hover:text-texto motion-safe:active:scale-[0.98]"
          >
            {sugestao}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Enquanto a resposta não chega: uma bolha do agente com o BimoThinking no
 * lugar do texto — o design system pede o grafo, não um spinner.
 */
function Pensando() {
  return (
    <div className="flex justify-start">
      <div className="space-y-1">
        <div className="rounded-bolha rounded-bl-sm border border-borda bg-bolha-agente px-4 py-3">
          <BimoPensando />
        </div>
        <AssinaturaDoBimo />
      </div>
    </div>
  );
}
