"use client";
import { useEffect, useRef, useState } from "react";
import { avisarLixeiraAlterada, listarLixeira, mudarLixeira } from "@/lib/cliente-de-notas";
import type { NotaNaLixeira } from "@/lib/repositorio-de-notas/tipos";
import Dialogo from "./Dialogo";

export default function Lixeira({ aoFechar }: { aoFechar(): void }) {
  const [notas, definirNotas] = useState<NotaNaLixeira[] | null>(null);
  const [erro, definirErro] = useState("");
  const [ocupada, definirOcupada] = useState<string | null>(null);
  const [aviso, definirAviso] = useState("");
  const [tentativa, tentar] = useState(0);
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
  return <Dialogo titulo="Lixeira" aoFechar={aoFechar} ocupado={ocupada !== null}>
    <p className="mb-4 text-controle text-suave">As notas ficam aqui até você restaurá-las. O conteúdo e o histórico são preservados.</p>
    <p role="status" className="text-controle">{notas === null && !erro ? "Carregando lixeira…" : aviso}</p>
    {erro && <div role="alert" className="mb-3 text-controle"><p>{erro}</p><button type="button" disabled={ocupada !== null} className="min-h-10 rounded-full px-3 hover:bg-painel-alt" onClick={() => { definirErro(""); definirNotas(null); tentar((n) => n + 1); }}>Atualizar lixeira</button></div>}
    {notas?.length === 0 && <p className="py-4 text-controle text-suave">A lixeira está vazia.</p>}
    <ul ref={lista} tabIndex={0} aria-label="Notas na lixeira" className="space-y-2 outline-destaque">
      {notas?.map((nota) => <li key={nota.id} className="flex items-center justify-between gap-3 rounded-bloco border border-borda p-3">
        <div className="min-w-0"><p className="break-words font-semibold">{nota.titulo}</p><p className="text-meta text-suave">{nota.pasta ?? "Raiz"} · Removida em {new Date(nota.removidaEm).toLocaleDateString("pt-BR")}</p></div>
        <button type="button" aria-label={`Restaurar ${nota.titulo}`} disabled={ocupada !== null} onClick={() => void restaurar(nota)} className="min-h-10 shrink-0 rounded-full border border-borda px-3 text-controle hover:bg-painel-alt disabled:opacity-50">{ocupada === nota.id ? "Restaurando…" : "Restaurar"}</button>
      </li>)}
    </ul>
  </Dialogo>;
}
