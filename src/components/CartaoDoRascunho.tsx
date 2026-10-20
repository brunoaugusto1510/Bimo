"use client";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { AcaoDoRascunho } from "@/lib/edicao/pedido-de-rascunho";
import type { EstadoDoRascunho } from "@/lib/espaco-de-trabalho/usar-rascunho-do-bimo";
import BimoPensando from "./BimoPensando";

type Props = {
  estado: EstadoDoRascunho;
  aoAceitar(): void;
  aoDescartar(): void;
  aoTentarDeNovo(): void;
  aoCancelar(): void;
  aoFechar(): void;
};

const ROTULO_DA_PROPOSTA: Record<AcaoDoRascunho, string> = { continuar: "Continuação sugerida", resumir: "Resumo sugerido", melhorar: "Versão melhorada" };
const TEXTO_DE_GERANDO: Record<AcaoDoRascunho, string> = { continuar: "Escrevendo a continuação…", resumir: "Resumindo o trecho…", melhorar: "Melhorando o trecho…" };
// A proposta entra onde o pedido saiu, não onde o cursor estiver na hora de aceitar.
const ONDE_ENTRA: Record<AcaoDoRascunho, string> = { continuar: "Entra no ponto onde você pediu.", resumir: "Entra abaixo do trecho que você selecionou.", melhorar: "Troca o trecho que você selecionou." };

const caixa = "mt-3 rounded-painel border border-destaque-suave-borda p-4";
const botao = "min-h-10 rounded-full px-4 text-controle font-semibold transition-[background-color,transform] motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque";
const botaoPrimario = `${botao} bg-destaque text-sobre-destaque hover:bg-destaque-hover`;
const botaoSecundario = `${botao} border border-borda text-texto hover:bg-painel-alt`;

/**
 * Monta junto com cada estado do cartão. O foco só vai ao primeiro botão quando estava na barra "Bimo sugere", no
 * próprio cartão ou perdido (o botão que o tinha saiu da tela): quem voltou a digitar no texto não tem o foco
 * roubado (um Enter ou espaço digitado ali aceitaria a proposta). Em qualquer caso o cartão é rolado para a vista.
 */
function ComFoco({ children }: { children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento) return;
    const ativo = document.activeElement;
    const podeFocar = !ativo || ativo === document.body || !!ativo.closest("[data-bimo-sugere]") || !!elemento.closest("section")?.contains(ativo);
    if (podeFocar) elemento.querySelector<HTMLElement>("button")?.focus();
    else elemento.scrollIntoView?.({ block: "nearest" });
  }, []);
  return <div ref={raiz}>{children}</div>;
}

/**
 * Onde o Bimo mostra o que escreveu: o pedido em andamento (com Cancelar; Esc também cancela), a proposta ou o
 * erro. O texto é PURO (`whitespace-pre-wrap`): o que o modelo devolve nunca passa pelo renderizador de Markdown
 * nem vira HTML. O conteúdo é gerado por IA: nada entra na nota sem o clique em Aceitar.
 */
export default function CartaoDoRascunho({ estado, aoAceitar, aoDescartar, aoTentarDeNovo, aoCancelar, aoFechar }: Props) {
  const idDoTexto = useId();
  const idDaMensagem = useId();
  if (estado.tipo === "ocioso") return null;
  const aoTeclar = (evento: KeyboardEvent<HTMLElement>) => {
    if (evento.key === "Escape" && estado.tipo === "gerando") { evento.preventDefault(); evento.stopPropagation(); aoCancelar(); }
  };

  if (estado.tipo === "gerando") {
    return (
      <section aria-label="Bimo escrevendo" onKeyDown={aoTeclar} className={`${caixa} bg-painel-alt`}>
        <ComFoco key="gerando">
          <div className="flex flex-wrap items-center gap-3">
            <BimoPensando texto={TEXTO_DE_GERANDO[estado.acao]} />
            <button type="button" onClick={aoCancelar} className={botaoSecundario}>Cancelar</button>
          </div>
        </ComFoco>
      </section>
    );
  }

  if (estado.tipo === "proposta") {
    return (
      <section aria-label="Proposta do Bimo" className={`${caixa} bg-destaque-suave motion-safe:animate-entrada`}>
        <ComFoco key="proposta">
          <p className="text-meta font-semibold text-destaque-texto">{ROTULO_DA_PROPOSTA[estado.acao]} · gerada pelo Bimo</p>
          <p id={idDoTexto} className="mt-2 whitespace-pre-wrap break-words text-corpo text-texto">{estado.texto}</p>
          <p className="mt-2 text-meta text-texto">{ONDE_ENTRA[estado.acao]} Confira antes de aceitar.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* O foco chega no Aceitar: a descrição faz o leitor de tela ler o texto que se está aceitando. */}
            <button type="button" aria-describedby={idDoTexto} onClick={aoAceitar} className={botaoPrimario}>Aceitar</button>
            <button type="button" onClick={aoDescartar} className={botaoSecundario}>Descartar</button>
            <button type="button" onClick={aoTentarDeNovo} className={botaoSecundario}>Tentar de novo</button>
          </div>
        </ComFoco>
      </section>
    );
  }

  return (
    <section aria-label="Bimo sugere: aviso" className={`${caixa} bg-erro-suave`}>
      <ComFoco key="erro">
        <p id={idDaMensagem} role="alert" className="text-controle text-erro">{estado.mensagem}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {estado.acao && <button type="button" aria-describedby={idDaMensagem} onClick={aoTentarDeNovo} className={botaoPrimario}>Tentar de novo</button>}
          <button type="button" aria-describedby={idDaMensagem} onClick={aoFechar} className={botaoSecundario}>Fechar</button>
        </div>
      </ComFoco>
    </section>
  );
}
