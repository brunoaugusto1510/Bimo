"use client";
import { useState, type ReactNode } from "react";
import type { ResumoDoCerebro } from "@/lib/wiki/cliente";
import type { EventoWiki, TipoDeEventoWiki } from "@/lib/wiki/observabilidade-tipos";
import MarcaBimo from "../MarcaBimo";
import GlifoDoNeuronio from "./GlifoDoNeuronio";
import { acaoDeTexto, botaoIcone, botaoPrimario, botaoSecundario, cartao, rotuloDeSecao } from "./estilos";
import { nasceuNaSemana } from "./filtro-do-cerebro";

type Cursor = { criadoEm: string; id: string };
type Props = {
  eventos: EventoWiki[];
  proximo: Cursor | null;
  paginado: boolean;
  aoPaginar: (cursor: Cursor | null) => void;
  cerebro: ResumoDoCerebro | undefined;
  erroDoCerebro?: string;
  aoVerCerebro: () => void;
  aoFechar: () => void;
  aoAbrirNeuronio: (id: string) => void;
  aoAbrirNota?: (id: string) => void;
};

const ROTULOS: Record<TipoDeEventoWiki, string> = {
  nasceu: "Nasceu um neurônio", cresceu: "Cresceu", discordam: "Suas notas discordam", precisa_de_voce: "Precisa de você",
  sem_novidade: "Li e não havia nada novo", despertar: "Despertar das notas antigas", energia: "Energia de hoje",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact" });

/** "às 2h14" hoje; "21 de out., 23h40" em outro dia. */
function quando(valor: string, hoje: Date): string {
  const data = new Date(valor);
  const hora = `${data.getHours()}h${String(data.getMinutes()).padStart(2, "0")}`;
  if (data.toDateString() !== hoje.toDateString()) return `${data.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}, ${hora}`;
  return `${data.getHours() === 1 ? "à" : "às"} ${hora}`;
}

/** A manchete do diário, na voz do Bimo: o que ele fez neste período. */
function manchete(eventos: EventoWiki[], hoje: Date): string {
  const conta = (tipo: TipoDeEventoWiki) => eventos.filter((e) => e.tipo === tipo).length;
  const [nasceu, cresceu, discordam, precisa, semNovidade] = (["nasceu", "cresceu", "discordam", "precisa_de_voce", "sem_novidade"] as const).map(conta);
  const partes = [
    nasceu && `fiz ${plural(nasceu, "neurônio novo", "neurônios novos")}`,
    cresceu && (cresceu === 1 ? "um neurônio cresceu" : `${cresceu} neurônios cresceram`),
    discordam && `achei ${plural(discordam, "divergência", "divergências")}`,
    semNovidade && `li ${plural(semNovidade, "nota", "notas")} sem nada novo`,
    precisa && `tenho ${plural(precisa, "pergunta", "perguntas")} para você`,
  ].filter((p): p is string => Boolean(p));
  const hora = hoje.getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  if (!partes.length) return `${saudacao}. Nada novo por aqui nos últimos sete dias.`;
  const frase = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
  return `${saudacao}. ${frase[0].toUpperCase()}${frase.slice(1)}.`;
}

function Glifo({ tipo }: { tipo: TipoDeEventoWiki }) {
  const estado = tipo === "discordam" ? "em_tensao" : tipo === "precisa_de_voce" ? "seu" : tipo === "energia" ? "em_pausa" : "vivo";
  return <GlifoDoNeuronio estado={estado} tamanho={32} halo={tipo === "nasceu"} />;
}

/**
 * "Enquanto você estava fora" (prancheta "Enquanto você estava fora"): o que o
 * Bimo consolidou, em cartões por tipo de evento, e ao lado o estado do
 * cérebro (despertar das notas antigas, neurônios, sinapses e energia). No
 * celular o resumo vira três números compactos acima dos cartões.
 */
export default function DiarioDaWiki({ eventos, proximo, paginado, aoPaginar, cerebro, erroDoCerebro, aoVerCerebro, aoFechar, aoAbrirNeuronio, aoAbrirNota }: Props) {
  const [hoje] = useState(() => new Date());
  const tituloDe = (id: string | null) => (id && cerebro?.neuronios.find((n) => n.id === id)?.titulo) || null;
  const destaques = eventos.filter((e) => e.tipo !== "sem_novidade");
  const semNovidade = eventos.filter((e) => e.tipo === "sem_novidade");

  function acoes(evento: EventoWiki): ReactNode {
    const id = evento.sinteseId;
    // Sem neurônio, o evento fala de uma nota sua (uma decisão adiada, por exemplo): a ação é abri-la.
    if (!id) return evento.origemId && aoAbrirNota ? <div><button type="button" className={acaoDeTexto} onClick={() => aoAbrirNota(evento.origemId!)}>Abrir nota</button></div> : null;
    if (evento.tipo === "nasceu") return <div className="grid grid-cols-2 gap-2 pt-1.5 md:flex md:flex-wrap"><button type="button" className={botaoPrimario} onClick={() => aoAbrirNeuronio(id)}>Abrir neurônio</button><button type="button" className={botaoSecundario} onClick={aoVerCerebro}>Ver no cérebro</button></div>;
    if (evento.tipo === "precisa_de_voce") return <div className="flex flex-wrap items-center gap-2 pt-1.5"><button type="button" className={botaoPrimario} onClick={() => aoAbrirNeuronio(id)}>Abrir neurônio</button><span className="text-meta">Lá você decide se devolve ao Bimo; seu texto pode ser reescrito.</span></div>;
    const rotulo = evento.tipo === "cresceu" ? "Ver o que mudou" : evento.tipo === "discordam" ? "Comparar os dois lados" : "Abrir neurônio";
    return <div><button type="button" className={acaoDeTexto} onClick={() => aoAbrirNeuronio(id)}>{rotulo}</button></div>;
  }

  const energia = cerebro?.energia;
  const livre = energia ? Math.round(energia.restante / energia.teto * 100) : null;
  const renova = energia ? `${new Date(energia.renovaEm).getHours()}h` : null;
  const novos = cerebro ? cerebro.neuronios.filter((n) => nasceuNaSemana(n, hoje.getTime())).length : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 md:px-8 md:py-10">
      <header className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex items-center justify-between gap-2 lg:contents">
          <span className="lg:hidden"><MarcaBimo tamanho={32} /></span>
          <span className="hidden lg:inline"><MarcaBimo tamanho={56} /></span>
          <div className="flex gap-2 lg:order-last">
            <button type="button" className={botaoSecundario} onClick={aoVerCerebro}>◈ Ver no cérebro</button>
            <button type="button" aria-label="Fechar diário" className={`${botaoIcone} border border-borda bg-painel`} onClick={aoFechar}>✕</button>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={rotuloDeSecao}>Enquanto você estava fora · últimos 7 dias</span>
          <h1 className="text-2xl font-semibold text-balance lg:text-3xl">{manchete(eventos, hoje)}</h1>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6">
        <aside aria-label="Resumo do cérebro" className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3 lg:order-last lg:grid-cols-2">
          {cerebro ? <>
            <div className={`flex flex-col gap-1.5 p-3 md:gap-2 md:p-4 lg:col-span-2 ${cartao}`}>
              <span className={`${rotuloDeSecao} hidden md:block`}>Despertar das notas antigas</span>
              <p className="flex flex-col lg:flex-row lg:items-baseline lg:gap-1.5"><strong className="text-xl font-bold tabular-nums md:text-3xl">{cerebro.resumo.notasLidas}</strong><span className="text-meta md:text-controle">de {cerebro.resumo.totalDeNotas} notas lidas</span></p>
              <progress aria-label="Notas antigas lidas" max={cerebro.resumo.totalDeNotas || 1} value={cerebro.resumo.notasLidas} className="wiki-progresso" />
              <p className="hidden text-controle text-pretty lg:block">As que já li ajudam nas conversas; as outras, ainda não.</p>
            </div>
            <div className={`flex flex-col gap-1 p-3 md:p-4 ${cartao}`}>
              <strong className="text-xl font-bold text-destaque-texto tabular-nums md:text-3xl">{cerebro.resumo.neuronios}</strong>
              <span className="text-meta md:text-controle">neurônios</span>
              {novos > 0 && <span className="text-meta text-suave tabular-nums">+{novos} esta semana</span>}
            </div>
            <div className={`hidden flex-col gap-1 p-4 md:flex ${cartao}`}>
              <strong className="text-3xl font-bold tabular-nums">{cerebro.resumo.sinapses}</strong>
              <span className="text-controle">sinapses</span>
            </div>
            {energia && livre !== null ? (
              <div className={`flex flex-col gap-1.5 p-3 md:gap-2 md:p-4 lg:col-span-2 ${cartao}`}>
                <span className={`${rotuloDeSecao} hidden md:block`}>Energia de hoje</span>
                <p className="flex flex-col lg:flex-row lg:items-baseline lg:gap-1.5"><strong className="text-xl font-bold tabular-nums md:text-3xl">{livre}%</strong><span className="text-meta md:text-controle">de energia livre</span></p>
                <progress aria-label="Energia disponível" value={energia.restante} max={energia.teto} className="wiki-progresso" />
                <p className="hidden text-controle text-pretty tabular-nums lg:block">{compacto.format(energia.utilizada)} de {compacto.format(energia.teto)} usados. Renova às {renova}. Se acabar, eu paro de consolidar; suas notas e o chat seguem normais.</p>
              </div>
            ) : <div className={`p-3 text-meta md:p-4 lg:col-span-2 ${cartao}`}>Energia indisponível agora.</div>}
          </> : <p className="col-span-3 text-controle md:col-span-4 lg:col-span-2">{erroDoCerebro ?? "Carregando o resumo…"}</p>}
        </aside>

        <section aria-label="O que mudou" className="flex min-w-0 flex-col gap-3">
          {destaques.map((evento) => {
            const nasceu = evento.tipo === "nasceu";
            // O texto do evento às vezes já traz o nome do neurônio; aí o título repetiria a mesma coisa.
            const titulo = tituloDe(evento.sinteseId);
            const mostrarTitulo = titulo && !evento.texto.includes(titulo);
            return (
              <article key={evento.id} className={`flex gap-3.5 rounded-card border p-4 ${nasceu ? "border-destaque-suave-borda bg-destaque-suave" : "border-borda bg-painel"}`}>
                <span className="hidden md:block"><Glifo tipo={evento.tipo} /></span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className={`flex items-center gap-1.5 text-meta ${nasceu ? "font-semibold text-destaque-texto" : evento.tipo === "precisa_de_voce" ? "font-semibold" : ""}`}>
                    <span className="md:hidden"><GlifoDoNeuronio estado={evento.tipo === "discordam" ? "em_tensao" : evento.tipo === "precisa_de_voce" ? "seu" : "vivo"} tamanho={16} /></span>
                    {ROTULOS[evento.tipo]} · {quando(evento.criadoEm, hoje)}
                  </p>
                  {mostrarTitulo && <h2 className={`text-corpo font-semibold ${nasceu ? "text-destaque-texto" : ""}`}>{titulo}</h2>}
                  <p className="text-controle text-pretty">{evento.texto}</p>
                  {acoes(evento)}
                </div>
              </article>
            );
          })}
          {semNovidade.length > 0 && (
            <details className="rounded-card border border-borda bg-painel-alt px-4 py-1">
              <summary className="flex min-h-10 cursor-pointer items-center text-controle">Li {plural(semNovidade.length, "nota", "notas")} e não havia nada novo para ligar</summary>
              <ul className="mb-3 flex flex-col gap-1 text-controle">{semNovidade.map((e) => <li key={e.id}>{e.texto}</li>)}</ul>
              <p className="mb-3 text-controle">Tudo bem: nem toda nota vira neurônio.</p>
            </details>
          )}
          {!eventos.length && <p className="py-8 text-controle">Nenhuma atividade neste período. Quando eu consolidar algo, aparece aqui.</p>}
          {(paginado || proximo) && (
            <div className="flex gap-2">
              {paginado && <button type="button" className={botaoSecundario} onClick={() => aoPaginar(null)}>Mais recentes</button>}
              {proximo && <button type="button" className={botaoSecundario} onClick={() => aoPaginar(proximo)}>Ver anteriores</button>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
