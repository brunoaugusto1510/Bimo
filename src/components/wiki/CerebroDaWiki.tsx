"use client";
import { useState } from "react";
import type { ResumoDoCerebro } from "@/lib/wiki/cliente";
import type { EstadoDoNeuronio } from "@/lib/wiki/observabilidade-tipos";
import MarcaBimo from "../MarcaBimo";
import GlifoDoNeuronio from "./GlifoDoNeuronio";
import { botaoDoBimo, botaoIcone, botaoPrimario, botaoSecundario, cartao, chip, rotuloDeSecao } from "./estilos";
import { nasceuNaSemana, precisaDeVoce, type FiltroDoCerebro } from "./filtro-do-cerebro";

/** O neurônio escolhido no grafo, com as notas que o sustentam (as pontas das sinapses). */
export type NeuronioSelecionado = { id: string; titulo: string; pasta: string | null; origens: string[] };

type Props = {
  dados: ResumoDoCerebro;
  filtro: FiltroDoCerebro;
  aoFiltrar: (filtro: FiltroDoCerebro) => void;
  selecionado: NeuronioSelecionado | null;
  aoFechar: () => void;
  aoAbrirNeuronio: (id: string) => void;
  aoVerOrigens?: () => void;
  aoPerguntar?: (id: string) => void;
  aoDesselecionar?: () => void;
};

const FRASE_DO_ESTADO: Record<Exclude<EstadoDoNeuronio, "vivo">, string> = {
  reconsolidando: "Uma origem mudou; vou revisar.",
  seu: "Você editou o texto: agora é seu, eu só leio e cito.",
  em_tensao: "Suas notas dizem coisas diferentes aqui.",
  sem_raizes: "As notas que o sustentavam sumiram; está fora das respostas.",
  em_pausa: "A consolidação dele está em pausa.",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function descreverOrigens(origens: string[]): string | null {
  if (!origens.length) return null;
  const citadas = origens.slice(0, 3).map((t) => `“${t}”`);
  const resto = origens.length - citadas.length;
  if (resto > 0) return `Liga ${citadas.join(", ")} e mais ${resto}.`;
  return citadas.length === 1 ? `Nasceu de ${citadas[0]}.` : `Liga ${citadas.slice(0, -1).join(", ")} e ${citadas.at(-1)}.`;
}

/**
 * O cérebro com neurônios (prancheta "Cérebro com neurônios"): por cima do
 * grafo, a legenda e os filtros no alto; embaixo, o que o Bimo está
 * consolidando e o cartão do neurônio escolhido. No celular a legenda some,
 * os filtros rolam de lado e o cartão vira uma folha presa à base.
 */
export default function CerebroDaWiki({ dados, filtro, aoFiltrar, selecionado, aoFechar, aoAbrirNeuronio, aoVerOrigens, aoPerguntar, aoDesselecionar }: Props) {
  const [agora] = useState(() => Date.now());
  const novos = dados.neuronios.filter((n) => nasceuNaSemana(n, agora)).length;
  const atencao = dados.neuronios.filter(precisaDeVoce).length;
  const filtros: [FiltroDoCerebro, string][] = [["tudo", "Tudo"], ["neuronios", "Só neurônios"], ["novos", `Nascidos esta semana · ${novos}`], ["atencao", `Precisam de você · ${atencao}`]];
  const energia = dados.energia ? `energia ${Math.round(dados.energia.restante / dados.energia.teto * 100)}%` : null;
  const { emConsolidacao, impedidas } = dados.resumo;
  const detalhe = selecionado ? dados.neuronios.find((n) => n.id === selecionado.id) : undefined;
  const estado = detalhe?.estado ?? "vivo";
  const meta = selecionado && ["Neurônio", selecionado.pasta, detalhe && plural(detalhe.fontes, "nota de origem", "notas de origem"), detalhe && plural(detalhe.afirmacoes, "afirmação", "afirmações")].filter(Boolean).join(" · ");
  const descricao = selecionado && [descreverOrigens(selecionado.origens), estado !== "vivo" ? FRASE_DO_ESTADO[estado] : null].filter(Boolean).join(" ");

  return (
    <div className="pointer-events-none flex h-full flex-col justify-between gap-3 p-3 md:p-5">
      <div className="flex items-start gap-3">
        <div className={`pointer-events-auto hidden flex-col gap-2 px-4 py-3 text-meta md:flex ${cartao}`}>
          <span className={rotuloDeSecao}>Legenda</span>
          <span className="flex items-center gap-2"><svg width="18" height="12" aria-hidden><circle cx="9" cy="6" r="4" className="fill-grafo-cor-3" /></svg>Suas notas, na cor da pasta</span>
          <span className="flex items-center gap-2"><GlifoDoNeuronio tamanho={18} />Neurônios, escritos pelo Bimo</span>
          <span className="flex items-center gap-2"><svg width="18" height="12" aria-hidden><path d="M1 10 Q9 0 17 6" fill="none" strokeWidth="1.6" className="stroke-destaque opacity-60" /></svg>Sinapses: de onde veio cada ideia</span>
        </div>
        <div className="pointer-events-auto flex min-w-0 flex-1 items-start gap-2">
          <div role="group" aria-label="Mostrar no cérebro" className="-m-1 flex min-w-0 flex-1 gap-2 overflow-x-auto p-1 md:flex-wrap md:overflow-visible">
            {filtros.map(([valor, rotulo]) => <button key={valor} type="button" aria-pressed={filtro === valor} className={`${chip(filtro === valor)} tabular-nums`} onClick={() => aoFiltrar(valor)}>{rotulo}</button>)}
          </div>
          <button type="button" aria-label="Fechar cérebro" className={`${botaoIcone} border border-borda bg-painel`} onClick={aoFechar}>✕</button>
        </div>
      </div>

      {!dados.neuronios.length && (
        <p className={`pointer-events-auto max-w-sm self-center px-4 py-3 text-center text-controle text-pretty ${cartao}`}>
          Ainda não nasceu nenhum neurônio. Eu leio suas notas conforme a fila e a energia do dia; quando ligar algumas, ele aparece aqui.
        </p>
      )}
      {dados.neuronios.length > 0 && ((filtro === "novos" && !novos) || (filtro === "atencao" && !atencao)) && (
        <p role="status" className={`pointer-events-auto max-w-sm self-center px-4 py-3 text-center text-controle text-pretty ${cartao}`}>
          {filtro === "novos" ? "Nenhum neurônio nasceu nesta semana." : "Nenhum neurônio precisa de você agora."}
        </p>
      )}

      <div className="flex min-h-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
        {/* Estático de propósito: a fila não diz se uma rodada está acontecendo agora, e a animação do Bimo pensando é só para isso. */}
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-2.5 gap-y-0.5 self-start rounded-bolha border border-borda bg-painel py-1.5 pr-4 pl-3 text-controle">
          <span className="flex items-center gap-2"><MarcaBimo tamanho={16} />{emConsolidacao > 0 ? `${plural(emConsolidacao, "nota", "notas")} na fila para consolidar` : dados.neuronios.length ? "Tudo consolidado" : "Nada na fila"}</span>
          {impedidas > 0 && <span className="tabular-nums">· {impedidas} {impedidas === 1 ? "precisa" : "precisam"} de atenção</span>}
          {energia && <span className="text-meta text-suave tabular-nums">· {energia}</span>}
        </div>

        {selecionado && (
          <section aria-label="Neurônio selecionado" className="pointer-events-auto -mx-3 -mb-3 flex min-h-0 flex-col gap-2.5 overflow-y-auto rounded-t-bolha border-t border-borda bg-painel px-4 pt-2 pb-6 shadow-foco motion-safe:animate-entrada md:m-0 md:ml-auto md:w-full md:max-w-md md:min-w-0 md:rounded-card md:border md:p-4">
            <span aria-hidden className="mx-auto h-1 w-9 rounded-full bg-borda md:hidden" />
            <div className="flex items-start gap-2">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-corpo font-semibold">
                <GlifoDoNeuronio estado={estado} tamanho={20} />
                <span className="truncate">{selecionado.titulo}</span>
              </h2>
              {aoDesselecionar && <button type="button" aria-label="Fechar cartão do neurônio" className={`${botaoIcone} -mt-2 -mr-2`} onClick={aoDesselecionar}>✕</button>}
            </div>
            <p className="text-meta tabular-nums">{meta}</p>
            {descricao && <p className="text-controle text-pretty">{descricao}</p>}
            <div className="grid grid-cols-2 gap-2 pt-1 md:flex md:flex-wrap">
              <button type="button" className={`${botaoPrimario} col-span-2`} onClick={() => aoAbrirNeuronio(selecionado.id)}>Abrir neurônio</button>
              {aoVerOrigens && <button type="button" className={botaoSecundario} onClick={aoVerOrigens}>Ver origens</button>}
              {aoPerguntar && <button type="button" aria-label="Perguntar ao Bimo" className={botaoDoBimo} onClick={() => aoPerguntar(selecionado.id)}><MarcaBimo tamanho={16} /><span className="md:hidden">Perguntar</span><span className="hidden md:inline">Perguntar ao Bimo</span></button>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
