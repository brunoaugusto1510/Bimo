"use client";
import { useState } from "react";
import { ESTADOS_DO_NEURONIO, type PaginaDoDiario, type ResumoDoCerebro } from "@/lib/wiki/cliente";
import { useConsultaWiki } from "./usar-consulta-wiki";
import { acaoWiki } from "./estilos";
import { useFocoDoPainel } from "./usar-foco-do-painel";

type Props = { tela: "cerebro" | "diario"; aoFechar: () => void; aoAbrirNeuronio: (id: string) => void; aoVerCerebro: () => void; somenteNeuronios?: boolean; aoFiltrarNeuronios?: (valor: boolean) => void };
const rotulos = { nasceu: "Nasceu um neurônio", cresceu: "Cresceu", discordam: "Suas notas discordam", precisa_de_voce: "Precisa de você", sem_novidade: "Li e não havia nada novo", despertar: "Despertar das notas antigas", energia: "Energia de hoje" };
const horario = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));

export default function PainelDaWiki({ tela, aoFechar, aoAbrirNeuronio, aoVerCerebro, somenteNeuronios = false, aoFiltrarNeuronios }: Props) {
  const foco = useFocoDoPainel(tela);
  const [tentativa, tentar] = useState(0);
  const cerebro = useConsultaWiki<ResumoDoCerebro>("/api/wiki/cerebro", tentativa);
  const [periodo] = useState(() => ({ inicio: new Date(Date.now() - 7 * 86_400_000).toISOString(), fim: new Date().toISOString() }));
  const [cursor, ir] = useState<{ criadoEm: string; id: string } | null>(null);
  const [filtro, filtrar] = useState<"todos" | "novos" | "atencao">("todos");
  const consulta = new URLSearchParams({ ...periodo, limite: "30", ...(cursor ? { antesEm: cursor.criadoEm, antesId: cursor.id } : {}) });
  const diario = useConsultaWiki<PaginaDoDiario>(tela === "diario" ? `/api/wiki/diario?${consulta}` : null, tentativa);
  const atual = tela === "diario" ? diario : cerebro;
  const dados = cerebro?.dados;
  const energia = dados?.energia;
  const livre = energia ? Math.round(energia.restante / energia.teto * 100) : null;
  const resumo = <div className="grid gap-3"><p className="text-meta tabular-nums">{dados?.resumo.notasLidas} de {dados?.resumo.totalDeNotas} notas lidas</p><progress aria-label="Notas lidas" max={dados?.resumo.totalDeNotas || 1} value={dados?.resumo.notasLidas ?? 0} className="wiki-progresso" /><div className="grid grid-cols-2 gap-3"><div className="rounded-card border border-borda bg-painel p-4"><strong className="block text-titulo-nota tabular-nums">{dados?.resumo.neuronios}</strong><span className="text-meta">neurônios</span></div><div className="rounded-card border border-borda bg-painel p-4"><strong className="block text-titulo-nota tabular-nums">{dados?.resumo.sinapses}</strong><span className="text-meta">sinapses registradas</span></div></div>{energia && <section className="rounded-card border border-borda bg-painel p-4"><h2 className="font-semibold">Energia de hoje</h2><p className="my-2 text-titulo-nota tabular-nums">{livre}% livre</p><progress aria-label="Energia disponível" value={energia.restante} max={energia.teto} className="wiki-progresso" /><p className="mt-2 text-meta tabular-nums">{energia.utilizada.toLocaleString("pt-BR")} de {energia.teto.toLocaleString("pt-BR")} tokens usados. Renova em {horario(energia.renovaEm)}.</p><p className="mt-2 text-meta">Se acabar, a consolidação espera. Suas notas e o chat seguem normais.</p></section>}</div>;
  return <section ref={foco} tabIndex={-1} aria-label={tela === "diario" ? "Diário do cérebro" : "Cérebro"} className={`absolute inset-0 z-20 outline-none ${tela === "diario" ? "overflow-y-auto bg-fundo" : "pointer-events-none flex flex-col overflow-hidden"}`}>
    <header className="pointer-events-auto flex h-16 shrink-0 items-center justify-between gap-3 border-b border-borda bg-painel px-5"><h1 className="text-corpo font-semibold">{tela === "diario" ? "Enquanto você estava fora" : "Cérebro com neurônios"}</h1><button aria-label="Fechar cérebro" className={acaoWiki} onClick={aoFechar}>Fechar</button></header>
    {!atual ? <p role="status" className="pointer-events-auto bg-painel p-5">Carregando…</p> : atual.erro ? <div className="pointer-events-auto bg-painel p-6"><p role="alert">{atual.erro}</p>{atual.status === 401 ? <a className={acaoWiki} href="/login">Entrar novamente</a> : <button className={acaoWiki} onClick={() => tentar((n) => n + 1)}>Tentar de novo</button>}</div> : tela === "cerebro" ? <>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row"><div className="min-h-48 md:min-h-0 md:flex-1" aria-hidden />
      <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto border-t border-borda bg-painel-alt p-4 md:w-80 md:flex-none md:border-t-0 md:border-l">
        <p className="mb-3 text-meta">● Suas notas, na cor da pasta · ◉ Neurônios · ─ Sinapses</p>
        {aoFiltrarNeuronios && <div className="mb-3 flex gap-2" role="group" aria-label="Exibir no grafo"><button className={acaoWiki} aria-pressed={!somenteNeuronios} onClick={() => aoFiltrarNeuronios(false)}>Tudo</button><button className={acaoWiki} aria-pressed={somenteNeuronios} onClick={() => aoFiltrarNeuronios(true)}>Só neurônios</button></div>}
        <div className="mb-4 flex flex-wrap gap-2">{([['todos', 'Todos'], ['novos', 'Nascidos esta semana'], ['atencao', 'Precisam de você']] as const).map(([valor, rotulo]) => <button key={valor} aria-pressed={filtro === valor} className={`${acaoWiki} ${filtro === valor ? "bg-destaque-suave" : "bg-painel"}`} onClick={() => filtrar(valor)}>{rotulo}</button>)}</div>
        <p className="mb-2 text-meta tabular-nums">{dados?.resumo.emConsolidacao ?? 0} notas em consolidação · {dados?.resumo.impedidas ?? 0} precisam de atenção</p>
        <ul className="mb-4 max-h-64 overflow-y-auto">{dados?.neuronios.filter((n) => filtro === "todos" || filtro === "atencao" && (n.alertas.length || !["vivo", "reconsolidando"].includes(n.estado)) || filtro === "novos" && n.criadoEm && Date.parse(periodo.fim) - Date.parse(n.criadoEm) < 7 * 86_400_000).map((n) => <li key={n.id}><button className="min-h-10 w-full rounded-card border-b border-borda px-3 py-3 text-left text-controle hover:bg-destaque-suave" onClick={() => aoAbrirNeuronio(n.id)}><strong className="text-destaque-texto">◉ {n.titulo}</strong><span className="mt-1 block text-meta">{ESTADOS_DO_NEURONIO[n.estado]} · {n.fontes} origens · {n.afirmacoes} afirmações</span></button></li>)}</ul>
        {!dados?.neuronios.length && <p className="mb-4 text-controle">Ainda não nasceu nenhum neurônio. Suas notas serão lidas conforme a fila e a energia disponível.</p>}
        {dados && resumo}
      </div></div>
    </> : <div className="mx-auto grid max-w-5xl gap-6 px-5 py-6 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div><p className="mb-2 text-meta">{horario(periodo.inicio)} a {horario(periodo.fim)}</p><p className="mb-5 text-corpo text-pretty">O que o Bimo leu, reuniu e deixou para você conferir.</p><button className={acaoWiki} onClick={aoVerCerebro}>Ver no cérebro</button>
        <div className="mt-5 flex flex-col gap-4">{diario?.dados?.eventos.map((e) => <article key={e.id} className="rounded-card border border-borda bg-painel p-5"><p className="text-meta text-suave">{rotulos[e.tipo]} · {horario(e.criadoEm)}</p><p className="my-3 text-corpo">{e.texto}</p>{e.sinteseId && <button className={acaoWiki} onClick={() => aoAbrirNeuronio(e.sinteseId!)}>Abrir neurônio</button>}</article>)}{!diario?.dados?.eventos.length && <p className="py-8 text-controle">Nenhuma atividade neste período. Quando houver novidades, elas aparecerão aqui.</p>}</div>
        <div className="mt-4 flex gap-2">{cursor && <button className={acaoWiki} onClick={() => ir(null)}>Mais recentes</button>}{diario?.dados?.proximo && <button className={acaoWiki} onClick={() => ir(diario.dados!.proximo)}>Ver anteriores</button>}</div>
      </div><aside aria-label="Resumo do cérebro">{dados ? resumo : <p>{cerebro?.erro ?? "Carregando resumo…"}</p>}</aside>
    </div>}
  </section>;
}
