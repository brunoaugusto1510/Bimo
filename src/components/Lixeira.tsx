"use client";
import { useEffect, useRef, useState } from "react";
import { avisarLixeiraAlterada, listarLixeira, mudarLixeira } from "@/lib/cliente-de-notas";
import type { NotaNaLixeira } from "@/lib/repositorio-de-notas/tipos";
import Dialogo from "./Dialogo";

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

function IconeLixeira({ className = "size-5" }: { className?: string }) {
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg>;
}

export default function Lixeira({ aoFechar }: { aoFechar(): void }) {
  const [notas, definirNotas] = useState<NotaNaLixeira[] | null>(null);
  const [erro, definirErro] = useState("");
  const [ocupada, definirOcupada] = useState<string | null>(null);
  const [aviso, definirAviso] = useState("");
  const [tentativa, tentar] = useState(0);
  const [busca, definirBusca] = useState("");
  const voo = useRef(false), lista = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const controle = new AbortController();
    listarLixeira(controle.signal).then(({ notas }) => { if (!controle.signal.aborted) definirNotas(notas); },
      () => { if (!controle.signal.aborted) definirErro("Não foi possível carregar a lixeira. Tente novamente."); });
    return () => controle.abort();
  }, [tentativa]);
  async function restaurar(nota: NotaNaLixeira) {
    if (voo.current) return;
    voo.current = true; definirOcupada(nota.id); definirErro(""); definirAviso("");
    try {
      const resultado = await mudarLixeira(nota.id, nota.revisao, true);
      if (resultado.tipo === "ok") {
        definirNotas((notas) => notas?.filter((n) => n.id !== nota.id) ?? []);
        definirAviso(`Nota «${nota.titulo}» restaurada.`);
        avisarLixeiraAlterada(resultado.nota, false);
        lista.current?.focus();
      } else if (resultado.tipo === "titulo-em-uso") definirErro(`Já existe «${nota.titulo}» em ${nota.pasta ?? "Raiz"}. Renomeie ou mova a nota existente e tente restaurar novamente.`);
      else {
        definirErro(resultado.tipo === "erro" ? resultado.mensagem : "A nota mudou ou já foi restaurada. Atualize a lixeira e tente novamente.");
      }
    } catch { definirErro("Não foi possível restaurar. Tente novamente; sua nota continua preservada."); }
    finally { voo.current = false; definirOcupada(null); }
  }
  const consulta = normalizar(busca.trim());
  const filtradas = notas?.filter((nota) => normalizar(`${nota.titulo} ${nota.pasta ?? "Raiz"}`).includes(consulta));
  return <Dialogo titulo="Lixeira" aoFechar={aoFechar} ocupado={ocupada !== null}>
    <div className="mb-5 flex items-start gap-3 rounded-bloco border border-borda bg-fundo p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-painel-alt text-suave"><IconeLixeira /></span>
      <div><p className="text-controle font-semibold">Suas notas continuam guardadas</p><p className="mt-1 text-controle text-pretty">Restaure uma nota para devolvê-la à pasta de origem, com o conteúdo e o histórico preservados.</p></div>
    </div>
    {notas !== null && notas.length > 0 && <div className="mb-4">
      <label htmlFor="busca-lixeira" className="sr-only">Buscar na lixeira</label>
      <div className="flex items-center gap-2 rounded-bloco border border-borda bg-fundo px-3 focus-within:border-destaque">
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4 shrink-0 text-suave"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
        <input id="busca-lixeira" type="search" value={busca} onChange={(e) => definirBusca(e.target.value)} placeholder="Buscar por título ou pasta" className="min-h-11 w-full min-w-0 bg-transparent text-controle text-texto outline-none placeholder:text-suave" />
      </div>
      <p className="mt-3 text-meta text-suave">{consulta ? `${filtradas?.length} de ${notas.length}` : notas.length} {notas.length === 1 ? "nota guardada" : "notas guardadas"}</p>
    </div>}
    <p role="status" className={aviso ? "mb-3 rounded-bloco bg-destaque-suave p-3 text-controle text-destaque-texto" : "sr-only"}>{notas === null && !erro ? "Carregando lixeira…" : aviso}</p>
    {notas === null && !erro && <div aria-hidden className="space-y-3 py-2">{[0, 1, 2].map((n) => <div key={n} className="h-20 rounded-bloco bg-painel-alt motion-safe:animate-pulse" />)}</div>}
    {erro && <div role="alert" className="mb-3 rounded-bloco bg-erro-suave p-3 text-controle text-erro"><p>{erro}</p><button type="button" disabled={ocupada !== null} className="mt-2 min-h-10 rounded-full border border-current px-3 font-semibold disabled:opacity-50" onClick={() => { definirErro(""); definirNotas(null); tentar((n) => n + 1); }}>Atualizar lixeira</button></div>}
    {notas?.length === 0 && <div className="flex flex-col items-center py-10 text-center"><span className="mb-4 flex size-16 items-center justify-center rounded-full bg-painel-alt text-suave"><IconeLixeira className="size-7" /></span><p className="font-semibold">A lixeira está vazia.</p><p className="mt-2 max-w-xs text-controle text-pretty">As notas que você mover para cá aparecerão aqui para restaurar quando precisar.</p></div>}
    {!!notas?.length && filtradas?.length === 0 && <div className="py-8 text-center"><p className="font-semibold">Nenhuma nota encontrada</p><p className="mt-2 text-controle">Tente outro título ou nome de pasta.</p><button type="button" onClick={() => definirBusca("")} className="mt-3 min-h-10 rounded-full px-4 text-controle text-destaque-texto hover:bg-destaque-suave">Limpar busca</button></div>}
    <ul ref={lista} tabIndex={0} aria-label="Notas na lixeira" className="space-y-2 rounded-bloco outline-destaque">
      {filtradas?.map((nota) => <li key={nota.id} className="flex flex-wrap items-center gap-3 rounded-bloco border border-borda p-3 transition-colors hover:bg-fundo sm:flex-nowrap">
        <span className="hidden size-10 shrink-0 items-center justify-center rounded-bloco bg-painel-alt text-suave sm:flex"><svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5"><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6" /></svg></span>
        <div className="min-w-0 flex-1"><p className="break-words text-controle font-semibold">{nota.titulo}</p><p className="mt-1 break-words text-meta text-suave">{nota.pasta ?? "Raiz"}</p><p className="mt-1 text-meta text-suave">Removida em <time dateTime={nota.removidaEm}>{new Date(nota.removidaEm).toLocaleDateString("pt-BR")}</time></p></div>
        <button type="button" aria-label={`Restaurar ${nota.titulo}`} disabled={ocupada !== null} onClick={() => void restaurar(nota)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-destaque-suave px-3 text-controle font-semibold text-destaque-texto transition-colors hover:bg-destaque-suave-borda focus-visible:outline-2 focus-visible:outline-destaque disabled:opacity-50"><span aria-hidden>↶</span>{ocupada === nota.id ? "Restaurando…" : "Restaurar"}</button>
      </li>)}
    </ul>
    <p className="mt-5 border-t border-borda pt-3 text-meta text-suave">As notas não são apagadas automaticamente.</p>
  </Dialogo>;
}
