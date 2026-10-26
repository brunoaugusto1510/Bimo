"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { ESTADOS_DO_NEURONIO, type DetalheDoNeuronio } from "@/lib/wiki/cliente";
import MarcaBimo from "../MarcaBimo";
import GlifoDoNeuronio from "./GlifoDoNeuronio";
import { useConsultaWiki } from "./usar-consulta-wiki";
import { acaoDeTexto, botaoDoBimo, botaoIcone, botaoPrimario, botaoSecundario, cartao, rotuloDeSecao } from "./estilos";

type Props = {
  id: string;
  aoAbrirNota: (id: string) => void;
  aoEditar: (id: string) => void;
  aoPerguntar: (id: string) => void;
  tituloDaNota?: (id: string) => string | undefined;
  aoVoltar?: () => void;
  aoFechar?: () => void;
};

const AVISO_DO_ESTADO = {
  reconsolidando: "Uma origem mudou. Até eu revisar, este neurônio não vale sozinho como prova.",
  seu: "Você editou este neurônio. Agora é seu: eu só leio e cito.",
  em_tensao: "Suas notas guardam perspectivas diferentes. Confira os dois contextos.",
  sem_raizes: "As notas que o sustentavam não estão mais disponíveis. Ele fica fora das respostas até ganhar novas origens.",
  em_pausa: "A consolidação deste neurônio está em pausa.",
} as const;

const CONSULTA_ESTREITA = "(max-width: 767px)";
function assinarTela(avisar: () => void) {
  const consulta = typeof window !== "undefined" ? window.matchMedia?.(CONSULTA_ESTREITA) : undefined;
  consulta?.addEventListener?.("change", avisar);
  return () => consulta?.removeEventListener?.("change", avisar);
}
/** No celular (abaixo de `md`) a sinapse tocada abre numa folha presa à base; acima, a lista ao lado (ou abaixo) do texto recebe o foco. */
const useTelaEstreita = () => useSyncExternalStore(assinarTela, () => window.matchMedia?.(CONSULTA_ESTREITA).matches ?? false, () => false);
const dia = (valor: string) => new Date(valor).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });

/** O neurônio aberto (prancheta "Neurônio aberto, com sinapses"): o texto do Bimo com as citações e, ao lado, de onde veio cada ideia. */
export default function NeuronioAberto({ id, aoAbrirNota, aoEditar, aoPerguntar, tituloDaNota, aoVoltar, aoFechar }: Props) {
  const [revisao, atualizar] = useState(0);
  const consulta = useConsultaWiki<DetalheDoNeuronio>(`/api/wiki?id=${encodeURIComponent(id)}`, revisao);
  const [ocupado, ocupar] = useState(false); const [aviso, avisar] = useState("");
  const [sinapse, selecionar] = useState<string | null>(null);
  const estreita = useTelaEstreita();
  const paineis = useRef(new Map<string, HTMLElement>());
  const folha = useRef<HTMLElement>(null);
  const lista = useRef<HTMLElement>(null);
  // Ao fechar a folha da sinapse o foco volta à citação que a abriu, em vez de cair no <body>.
  const citacoes = useRef(new Map<string, HTMLButtonElement>());

  const nav = (titulo?: string, pasta?: string | null) => (aoVoltar || aoFechar) && (
    <nav aria-label="Caminho do neurônio" className="sticky top-0 z-10 flex items-center gap-1 border-b border-borda bg-painel px-2 py-1.5 text-controle">
      {aoVoltar && <button type="button" aria-label="Voltar ao cérebro" className={botaoIcone} onClick={aoVoltar}>←</button>}
      <span className="min-w-0 flex-1 truncate px-2 text-suave">{pasta && <span className="hidden md:inline">{pasta} / </span>}<strong className="font-semibold text-texto">{titulo ?? "Neurônio"}</strong></span>
      {aoFechar && <button type="button" aria-label="Fechar neurônio" className={botaoIcone} onClick={aoFechar}>✕</button>}
    </nav>
  );

  if (!consulta) return <>{nav()}<p role="status" className="p-8 text-controle">Abrindo neurônio…</p></>;
  if (!consulta.dados) return <>{nav()}<div className="flex flex-col items-start gap-3 p-8"><p role="alert" className="text-controle">{consulta.erro}</p><button type="button" className={botaoSecundario} onClick={() => atualizar((n) => n + 1)}>Tentar de novo</button></div></>;
  const { nota, evidencias, estadoNeuronio, pausada } = consulta.dados;
  const protegida = estadoNeuronio === "seu" || evidencias.gerencia?.protegida || nota.revisao !== (evidencias.gerencia?.revisao ?? evidencias.revisaoPublicada);
  const textoPosterior = nota.revisao !== evidencias.revisaoPublicada;
  const fontes = new Map(evidencias.fontes.map((f, i) => [f.id, { ...f, numero: i + 1 }]));
  const sinapses = evidencias.afirmacoes.flatMap((a) => a.evidencias.map((e, i) => ({ chave: `${a.id}:${i}`, afirmacao: a, evidencia: e, fonte: fontes.get(e.fonteId) })));
  const indice = sinapses.findIndex((s) => s.chave === sinapse);
  const atual = indice >= 0 ? sinapses[indice] : null;

  const gerir = async (mudanca: { gerenciada: boolean } | { pausada: boolean }) => {
    if (ocupado) return;
    ocupar(true); avisar("");
    try {
      const r = await fetch("/api/wiki/gerenciamento", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notaId: id, revisaoBase: nota.revisao, ...mudanca }) });
      // Em conflito os dados são recarregados na hora: o clique seguinte já leva a revisão nova, em vez de repetir o mesmo 409.
      if (!r.ok) { if (r.status === 409) atualizar((n) => n + 1); avisar(r.status === 409 ? "O neurônio mudou e foi recarregado. Confira e tente novamente." : "Não consegui alterar o gerenciamento. Tente novamente."); return; }
      atualizar((n) => n + 1); avisar("Gerenciamento atualizado.");
    } catch { avisar("Não consegui alterar o gerenciamento. Tente novamente."); }
    finally { ocupar(false); }
  };
  function mostrarSinapse(chave: string) {
    selecionar(chave);
    if (estreita) { requestAnimationFrame(() => folha.current?.focus({ preventScroll: true })); return; }
    const painel = paineis.current.get(chave); painel?.scrollIntoView?.({ block: "nearest" }); painel?.focus({ preventScroll: true });
  }
  const meta = [nota.criadoEm && `nasceu em ${dia(nota.criadoEm)}`, nota.atualizadoEm && `atualizado em ${dia(nota.atualizadoEm)}`, `${fontes.size} ${fontes.size === 1 ? "nota" : "notas"} de origem`].filter(Boolean).join(" · ");
  const citacao = (chave: string, numero: number | undefined, texto: string) => (
    <button key={chave} ref={(el) => { if (el) citacoes.current.set(chave, el); else citacoes.current.delete(chave); }} type="button" aria-label={`Ver sinapse ${numero ?? "indisponível"} de ${texto}`} aria-pressed={sinapse === chave} onClick={() => mostrarSinapse(chave)}
      className={`relative ml-1 inline-flex -translate-y-1.5 items-center rounded-tag px-1.5 text-secao font-semibold transition-[background-color,color] after:absolute after:-inset-3 after:content-[''] focus-visible:outline-2 focus-visible:outline-destaque ${sinapse === chave ? "bg-destaque text-sobre-destaque" : "bg-destaque-suave text-destaque-texto hover:bg-destaque-suave-borda"}`}>
      {numero ?? "?"}
    </button>
  );

  return <>
    {nav(nota.titulo, nota.pasta)}
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_22rem]">
      <article className="bg-painel px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto flex max-w-[720px] flex-col gap-5">
          <div className="flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:items-center md:gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destaque-suave-borda bg-destaque-suave py-1 pr-3 pl-2 text-meta font-semibold text-destaque-texto">
              <GlifoDoNeuronio estado={protegida ? "seu" : "vivo"} tamanho={14} />Neurônio · {protegida ? "editado por você" : "escrito pelo Bimo"}
            </span>
            <span className="text-meta text-suave tabular-nums">{meta}</span>
          </div>
          <h1 className="text-titulo-nota font-semibold text-balance text-destaque-texto">{nota.titulo}</h1>
          {estadoNeuronio !== "vivo" && (
            <p className={`flex items-start gap-2.5 bg-fundo p-4 text-controle ${cartao}`}>
              <GlifoDoNeuronio estado={estadoNeuronio} tamanho={20} />
              <span><strong className="font-semibold">{ESTADOS_DO_NEURONIO[estadoNeuronio]}.</strong> {AVISO_DO_ESTADO[estadoNeuronio]}</span>
            </p>
          )}
          <div className="flex flex-col gap-3.5">
            {protegida || textoPosterior ? <p className="whitespace-pre-wrap text-corpo">{nota.conteudo}</p> : evidencias.afirmacoes.map((a) => (
              <p key={a.id} className="text-corpo text-pretty">
                <span className={a.natureza === "inferencia" ? "underline decoration-destaque decoration-dotted underline-offset-4" : ""}>{a.texto}</span>
                {a.natureza === "inferencia" && <span className="ml-1.5 rounded-tag border border-destaque-suave-borda px-1.5 py-px text-secao font-semibold whitespace-nowrap text-destaque-texto">inferência do Bimo</span>}
                {a.evidencias.map((e, i) => citacao(`${a.id}:${i}`, fontes.get(e.fonteId)?.numero, a.texto))}
              </p>
            ))}
          </div>
          {!!evidencias.estrutura.divergencias?.length && (
            <section aria-label="Onde suas notas divergem" className={`flex flex-col gap-2.5 bg-fundo p-4 ${cartao}`}>
              <h2 className={rotuloDeSecao}>Onde suas notas divergem</h2>
              {evidencias.estrutura.divergencias.map((d, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-2">
                  {[d.a, d.b].map((lado) => <div key={lado.afirmacaoId} className={`p-3 text-controle ${cartao}`}><strong className="font-semibold">{lado.contexto}</strong><p>“{evidencias.afirmacoes.find((a) => a.id === lado.afirmacaoId)?.texto ?? "Afirmação indisponível"}”</p></div>)}
                </div>
              ))}
            </section>
          )}
          {!!evidencias.estrutura.lacunas.length && (
            <section aria-label="Perguntas em aberto" className="flex flex-col gap-2">
              <h2 className={rotuloDeSecao}>Perguntas que você deixou em aberto</h2>
              {evidencias.estrutura.lacunas.map((l) => <p key={l} className="text-corpo">{l}</p>)}
            </section>
          )}
          {!!evidencias.estrutura.ligacoes.length && (
            <section aria-label="Neurônios relacionados" className="flex flex-col gap-2">
              <h2 className={rotuloDeSecao}>Neurônios relacionados</h2>
              <div className="flex flex-wrap gap-2">{evidencias.estrutura.ligacoes.map((ligado) => <button key={ligado} type="button" className={botaoSecundario} onClick={() => aoAbrirNota(ligado)}><GlifoDoNeuronio tamanho={16} />{tituloDaNota?.(ligado) ?? "Abrir neurônio relacionado"}</button>)}</div>
            </section>
          )}
          <div className="flex flex-wrap gap-2 border-t border-borda pt-5">
            <button type="button" className={botaoDoBimo} onClick={() => aoPerguntar(id)}><MarcaBimo tamanho={16} />Perguntar ao Bimo</button>
            <button type="button" className={botaoSecundario} onClick={() => aoEditar(id)}>Editar minha nota</button>
            <button type="button" aria-disabled={ocupado} className={botaoSecundario} onClick={() => void gerir({ pausada: !pausada })}>{pausada ? "Retomar consolidação" : "Pausar consolidação"}</button>
          </div>
          <p role="status" className="text-controle">{aviso}</p>
        </div>
      </article>

      <aside ref={lista} tabIndex={-1} aria-label="Sinapses" className="flex flex-col gap-3.5 border-t border-borda bg-painel-alt px-4 py-6 outline-none lg:border-t-0 lg:border-l lg:px-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-corpo font-semibold">Sinapses</h2>
          <span className="text-meta tabular-nums">{evidencias.afirmacoes.length} {evidencias.afirmacoes.length === 1 ? "afirmação" : "afirmações"} · {fontes.size} {fontes.size === 1 ? "nota" : "notas"}</span>
        </div>
        <p className="text-controle text-pretty">De onde veio cada ideia deste neurônio, no trecho e na revisão que eu li.</p>
        {(protegida || textoPosterior) && <p className="text-controle text-pretty">Estas sinapses são da última síntese do Bimo; seu texto atual pode ser diferente.</p>}
        {sinapses.map(({ chave, afirmacao, evidencia, fonte }) => {
          const ativa = sinapse === chave;
          return (
            <section key={chave} tabIndex={-1} ref={(el) => { if (el) paineis.current.set(chave, el); else paineis.current.delete(chave); }}
              className={`flex flex-col gap-1.5 rounded-card bg-painel px-3.5 py-3 outline-none ${ativa ? "border-2 border-destaque" : "border border-borda"}`}>
              <h3 className="flex items-center gap-2 text-controle font-semibold">
                <span className={`rounded-tag px-1.5 text-secao ${ativa ? "bg-destaque text-sobre-destaque" : "bg-destaque-suave text-destaque-texto"}`}>{fonte?.numero ?? "?"}</span>
                {fonte?.titulo ?? "Origem indisponível"}
              </h3>
              <blockquote className="text-controle italic">“{evidencia.citacao}”</blockquote>
              <div className="flex items-center justify-between gap-2">
                <span className="text-meta text-suave">revisão {fonte?.revisao ?? "indisponível"} · {afirmacao.natureza === "inferencia" ? "inferência" : "explícito"}</span>
                {fonte && <button type="button" className={acaoDeTexto} onClick={() => aoAbrirNota(fonte.id)}>Abrir nota</button>}
              </div>
            </section>
          );
        })}
        <div className="mt-2 flex flex-col gap-2.5 border-t border-borda pt-4">
          {protegida ? <>
            <p className="text-controle text-pretty">Ao devolver ao Bimo, seu texto pode ser reescrito na próxima consolidação.</p>
            <button type="button" aria-disabled={ocupado} className={`${botaoDoBimo} self-start`} onClick={() => void gerir({ gerenciada: true })}>Devolver ao Bimo</button>
          </> : <>
            <button type="button" role="switch" aria-checked="true" aria-disabled={ocupado} onClick={() => void gerir({ gerenciada: false })}
              className="flex min-h-10 items-center justify-between gap-3 text-left text-controle font-semibold focus-visible:outline-2 focus-visible:outline-destaque aria-disabled:cursor-wait aria-disabled:opacity-50">
              O Bimo cuida deste neurônio
              <span aria-hidden className="flex h-6.5 w-11 shrink-0 items-center justify-end rounded-full bg-destaque p-0.5"><span className="size-5.5 rounded-full bg-sobre-destaque" /></span>
            </button>
            <p className="text-controle text-pretty">Quando você anota algo novo sobre o assunto, eu atualizo o texto. Se você desligar ou editar o neurônio, ele passa a ser seu e eu paro de reescrever.</p>
          </>}
        </div>
      </aside>
    </div>

    {estreita && atual && (
      <section ref={folha} tabIndex={-1} aria-label={`Sinapse ${indice + 1} de ${sinapses.length}`}
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-3/4 flex-col gap-2.5 overflow-y-auto rounded-t-bolha border-t border-borda bg-painel px-4 pt-2 pb-6 shadow-foco outline-none motion-safe:animate-entrada">
        <span aria-hidden className="mx-auto h-1 w-9 rounded-full bg-borda" />
        <div className="flex items-center gap-2">
          <span className={`flex-1 ${rotuloDeSecao}`}>Sinapse {indice + 1} de {sinapses.length}</span>
          <button type="button" aria-label="Sinapse anterior" aria-disabled={indice === 0} className={`${botaoIcone} border border-borda aria-disabled:opacity-50`} onClick={() => indice > 0 && selecionar(sinapses[indice - 1].chave)}>‹</button>
          <button type="button" aria-label="Próxima sinapse" aria-disabled={indice === sinapses.length - 1} className={`${botaoIcone} border border-borda aria-disabled:opacity-50`} onClick={() => indice < sinapses.length - 1 && selecionar(sinapses[indice + 1].chave)}>›</button>
          <button type="button" aria-label="Fechar sinapse" className={botaoIcone} onClick={() => { const chave = atual.chave; selecionar(null); citacoes.current.get(chave)?.focus(); }}>✕</button>
        </div>
        {/* Anterior/próxima trocam o conteúdo sem mover o foco: a região anuncia a sinapse nova. */}
        <div aria-live="polite" className="flex flex-col gap-2.5">
          <h3 className="flex items-center gap-2 text-corpo font-semibold"><span className="rounded-tag bg-destaque px-1.5 text-secao text-sobre-destaque">{atual.fonte?.numero ?? "?"}</span>{atual.fonte?.titulo ?? "Origem indisponível"}</h3>
          <blockquote className="text-corpo italic">“{atual.evidencia.citacao}”</blockquote>
          <span className="text-meta text-suave">revisão {atual.fonte?.revisao ?? "indisponível"} · {atual.afirmacao.natureza === "inferencia" ? "inferência" : "explícito"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {atual.fonte ? <button type="button" className={botaoPrimario} onClick={() => aoAbrirNota(atual.fonte!.id)}>Abrir nota</button> : <span />}
          <button type="button" className={botaoSecundario} onClick={() => { selecionar(null); lista.current?.scrollIntoView?.({ block: "start" }); lista.current?.focus({ preventScroll: true }); }}>Ver as {sinapses.length}</button>
        </div>
      </section>
    )}
  </>;
}
