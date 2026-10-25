"use client";
import { useRef, useState } from "react";
import { ESTADOS_DO_NEURONIO, type DetalheDoNeuronio } from "@/lib/wiki/cliente";
import { useConsultaWiki } from "./usar-consulta-wiki";
import { acaoWiki } from "./estilos";

type Props = { id: string; aoAbrirNota: (id: string) => void; aoEditar: (id: string) => void; aoPerguntar: (id: string) => void; tituloDaNota?: (id: string) => string | undefined };
export default function NeuronioAberto({ id, aoAbrirNota, aoEditar, aoPerguntar, tituloDaNota }: Props) {
  const [revisao, atualizar] = useState(0);
  const consulta = useConsultaWiki<DetalheDoNeuronio>(`/api/wiki?id=${encodeURIComponent(id)}`, revisao);
  const [ocupado, ocupar] = useState(false); const [aviso, avisar] = useState("");
  const [sinapse, selecionar] = useState<string | null>(null);
  const paineis = useRef(new Map<string, HTMLElement>());
  if (!consulta) return <p role="status" className="p-8">Abrindo neurônio…</p>;
  if (!consulta.dados) return <div className="p-8"><p role="alert">{consulta.erro}</p><button className={acaoWiki} onClick={() => atualizar((n) => n + 1)}>Tentar de novo</button></div>;
  const { nota, evidencias, estadoNeuronio, pausada } = consulta.dados;
  const protegida = estadoNeuronio === "seu" || evidencias.gerencia?.protegida || nota.revisao !== (evidencias.gerencia?.revisao ?? evidencias.revisaoPublicada);
  const textoPosterior = nota.revisao !== evidencias.revisaoPublicada;
  const fontes = new Map(evidencias.fontes.map((f, i) => [f.id, { ...f, numero: i + 1 }]));
  const gerir = async (mudanca: { gerenciada: boolean } | { pausada: boolean }) => {
    if (ocupado) return;
    ocupar(true); avisar("");
    try {
      const r = await fetch("/api/wiki/gerenciamento", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ notaId: id, revisaoBase: nota.revisao, ...mudanca }) });
      if (!r.ok) { avisar(r.status === 409 ? "O neurônio mudou. Atualize os dados antes de tentar novamente." : "Não consegui alterar o gerenciamento. Tente novamente."); return; }
      atualizar((n) => n + 1); avisar("Gerenciamento atualizado.");
    } catch { avisar("Não consegui alterar o gerenciamento. Tente novamente."); }
    finally { ocupar(false); }
  };
  function mostrarSinapse(chave: string) {
    selecionar(chave); const painel = paineis.current.get(chave); painel?.scrollIntoView?.({ block: "nearest" }); painel?.focus({ preventScroll: true });
  }
  return <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_20rem]">
    <article className="bg-painel px-5 py-8 md:px-10">
      <div className="mx-auto flex max-w-[720px] flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-destaque-suave-borda bg-destaque-suave px-3 py-1 text-meta font-semibold text-destaque-texto">◉ Neurônio · {protegida ? "editado por você" : "escrito pelo Bimo"}</span><span className="text-meta">{ESTADOS_DO_NEURONIO[estadoNeuronio]} · {fontes.size} notas de origem</span></div>
        <h1 className="text-titulo-nota font-semibold text-balance text-destaque-texto">{nota.titulo}</h1>
        {estadoNeuronio !== "vivo" && <p className="rounded-card border border-borda bg-fundo p-4 text-controle">{{ reconsolidando: "Uma origem mudou. As afirmações aguardam revisão.", seu: "Você editou este neurônio. O Bimo preserva seu texto.", em_tensao: "Suas notas guardam perspectivas diferentes. Confira os dois contextos.", sem_raizes: "As notas de origem não estão disponíveis. Este neurônio está sem raízes.", em_pausa: "A consolidação deste neurônio está em pausa." }[estadoNeuronio]}</p>}
        {protegida || textoPosterior ? <p className="whitespace-pre-wrap text-corpo">{nota.conteudo}</p> : evidencias.afirmacoes.map((a) => <p key={a.id} className="text-corpo text-pretty">
          <span className={a.natureza === "inferencia" ? "underline decoration-dotted decoration-destaque underline-offset-4" : ""}>{a.texto}</span>
          {a.natureza === "inferencia" && <span className="ml-2 rounded-tag border border-destaque-suave-borda px-1 text-meta text-destaque-texto">inferência do Bimo</span>}
          {a.evidencias.map((e, i) => <button key={i} aria-label={`Ver sinapse ${fontes.get(e.fonteId)?.numero ?? "indisponível"} de ${a.texto}`} className="ml-1 min-h-10 min-w-10 rounded-tag text-meta font-semibold text-destaque-texto hover:bg-destaque-suave" onClick={() => mostrarSinapse(`${a.id}:${i}`)}>{fontes.get(e.fonteId)?.numero ?? "?"}</button>)}
        </p>)}
        {!!evidencias.estrutura.divergencias?.length && <section className="rounded-card border border-borda bg-fundo p-4"><h2 className="mb-3 text-secao font-semibold uppercase tracking-wide">Onde suas notas divergem</h2>{evidencias.estrutura.divergencias.map((d, i) => <div key={i} className="mb-3 grid gap-3 sm:grid-cols-2">{[d.a, d.b].map((lado) => <div key={lado.afirmacaoId} className="rounded-card border border-borda bg-painel p-3 text-controle"><strong>{lado.contexto}</strong><p>{evidencias.afirmacoes.find((a) => a.id === lado.afirmacaoId)?.texto ?? "Afirmação indisponível"}</p></div>)}</div>)}</section>}
        {!!evidencias.estrutura.lacunas.length && <section><h2 className="mb-2 text-secao font-semibold uppercase tracking-wide">Perguntas que você deixou em aberto</h2><ul className="list-inside list-disc text-corpo">{evidencias.estrutura.lacunas.map((l) => <li key={l}>{l}</li>)}</ul></section>}
        {!!evidencias.estrutura.ligacoes.length && <section><h2 className="text-secao font-semibold uppercase tracking-wide">Neurônios relacionados</h2>{evidencias.estrutura.ligacoes.map((ligado) => <button key={ligado} className={acaoWiki} onClick={() => aoAbrirNota(ligado)}>{tituloDaNota?.(ligado) ?? "Abrir neurônio relacionado"}</button>)}</section>}
        <div className="flex flex-wrap gap-2"><button className={acaoWiki} onClick={() => aoEditar(id)}>Editar minha nota</button><button className={acaoWiki} onClick={() => aoPerguntar(id)}>Perguntar ao Bimo</button><button disabled={ocupado} className={acaoWiki} onClick={() => void gerir({ pausada: !pausada })}>{pausada ? "Retomar consolidação" : "Pausar consolidação"}</button></div>
        {protegida && <div className="rounded-card border border-borda p-4"><p className="mb-2 text-controle">Ao devolver ao Bimo, seu texto pode ser reescrito na próxima consolidação.</p><button disabled={ocupado} className={acaoWiki} onClick={() => void gerir({ gerenciada: true })}>Devolver ao Bimo</button></div>}
        <p role="status" className="text-controle">{aviso}</p>
      </div>
    </article>
    <aside aria-label="Sinapses" className="flex flex-col gap-3 border-t border-borda bg-painel-alt p-5 lg:border-t-0 lg:border-l"><h2 className="font-semibold">Sinapses</h2><p className="text-controle">De onde veio cada ideia, no trecho e na revisão que o Bimo leu.</p>{(protegida || textoPosterior) && <p className="text-controle">Estas sinapses são da última síntese do Bimo; seu texto atual pode ser diferente.</p>}
      {evidencias.afirmacoes.flatMap((a) => a.evidencias.map((e, i) => { const chave = `${a.id}:${i}`; const fonte = fontes.get(e.fonteId); return <section key={chave} tabIndex={-1} ref={(el) => { if (el) paineis.current.set(chave, el); else paineis.current.delete(chave); }} className={`rounded-card border bg-painel p-4 ${sinapse === chave ? "border-destaque outline-1 outline-destaque" : "border-borda"}`}><h3 className="font-semibold text-controle">{fonte?.numero}. {fonte?.titulo ?? "Origem indisponível"}</h3><blockquote className="my-2 text-controle italic">“{e.citacao}”</blockquote><p className="text-meta text-suave">revisão {fonte?.revisao ?? "indisponível"} · {a.natureza === "inferencia" ? "inferência" : "explícito"}</p>{fonte && <button className={acaoWiki} onClick={() => aoAbrirNota(fonte.id)}>Abrir nota</button>}</section>; }))}
    </aside>
  </div>;
}
