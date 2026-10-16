"use client";

import { useId, useState } from "react";

type Props = {
  tags: string[];
  pasta: string | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  conexoes: number | null;
  agora?: Date;
};

function formatarData(valor: string, agora: Date): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data indisponível";
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  const mesmoDia = (outra: Date) => data.getFullYear() === outra.getFullYear() && data.getMonth() === outra.getMonth() && data.getDate() === outra.getDate();
  const prefixo = mesmoDia(agora) ? "hoje" : mesmoDia(ontem) ? "ontem" : null;
  return prefixo ? `${prefixo}, ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : data.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

export default function PropriedadesDaNota({ tags, pasta, criadoEm, atualizadoEm, conexoes, agora = new Date() }: Props) {
  const [aberta, definirAberta] = useState(true);
  const id = useId();
  return (
    <section aria-label="Propriedades" className="rounded-bloco border border-borda bg-fundo px-4 py-2">
      <button type="button" aria-expanded={aberta} aria-controls={id} onClick={() => definirAberta(!aberta)} className="flex min-h-10 items-center gap-2 rounded-full text-secao font-semibold text-suave uppercase transition-[color,transform] hover:text-texto motion-safe:active:scale-[0.96]">
        <span aria-hidden="true">{aberta ? "▾" : "▸"}</span>Propriedades
      </button>
      {aberta && <dl id={id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 pb-2 text-controle md:grid-cols-[96px_minmax(0,1fr)]">
        <dt className="text-suave">Tags</dt><dd className="flex flex-wrap gap-1.5">{tags.length ? tags.map((tag, indice) => <span key={`${tag}-${indice}`} className="rounded-tag bg-destaque-suave px-2.5 py-1 text-meta text-destaque-texto">#{tag.replace(/^#/, "")}</span>) : <span className="text-suave">Sem tags</span>}</dd>
        <dt className="text-suave">Pasta</dt><dd className="break-words">{pasta ?? "Raiz"}</dd>
        {criadoEm !== null && <><dt className="text-suave">Criada</dt><dd className="tabular-nums">{formatarData(criadoEm, agora)}</dd></>}
        {atualizadoEm !== null && <><dt className="text-suave">Editada</dt><dd className="tabular-nums">{formatarData(atualizadoEm, agora)}</dd></>}
        {conexoes !== null && <><dt className="text-suave">Conexões</dt><dd className="tabular-nums">◈ {conexoes}</dd></>}
      </dl>}
    </section>
  );
}
