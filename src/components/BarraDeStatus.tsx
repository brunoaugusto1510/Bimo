"use client";
import { useEffect, useRef, useState } from "react";
import type { EstadoDoSalvamento } from "@/lib/edicao/salvamento-automatico";

type Props = { itens: string[]; mensagem?: string; estado?: EstadoDoSalvamento; anuncioManual?: number };

export default function BarraDeStatus({ itens, mensagem, estado, anuncioManual = 0 }: Props) {
  const [anuncio, definirAnuncio] = useState("");
  const [emAlerta, definirEmAlerta] = useState(false);
  const ultimoErro = useRef("");
  const manualAnterior = useRef(0);
  useEffect(() => {
    const manual = manualAnterior.current !== anuncioManual;
    manualAnterior.current = anuncioManual;
    if (estado === "salvo") {
      ultimoErro.current = "";
      const limpar = manual ? setTimeout(() => definirAnuncio(""), 0) : undefined;
      const timer = setTimeout(() => { definirAnuncio("Salvo"); definirEmAlerta(false); }, manual ? 1 : 1500);
      return () => { clearTimeout(limpar); clearTimeout(timer); };
    }
    if (estado === "erro" || estado === "recusado" || estado === "conflito") {
      if (ultimoErro.current === mensagem) return;
      ultimoErro.current = mensagem ?? "";
      const timer = setTimeout(() => { definirAnuncio(mensagem ?? ""); definirEmAlerta(estado === "erro" || estado === "recusado"); }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => { if (!ultimoErro.current) definirAnuncio(""); }, 0);
    return () => clearTimeout(timer);
  }, [estado, mensagem, anuncioManual]);
  return (
    <footer className="flex min-h-8 h-auto shrink-0 items-center justify-end gap-4 border-t border-borda bg-painel-alt px-4 py-1 text-meta text-texto tabular-nums">
      <div className="hidden items-center gap-4 md:flex">{itens.map((item, indice) => <span key={indice}>{item}</span>)}</div>
      <span role={estado ? undefined : "status"} aria-hidden={estado ? true : undefined} className="min-w-0 break-words text-texto">{mensagem}</span>
      <span className="sr-only" role={estado ? (emAlerta ? "alert" : "status") : undefined} aria-atomic="true">{estado ? anuncio : ""}</span>
    </footer>
  );
}
