"use client";

import { useEffect, useId, useRef, useState } from "react";
import SeletorPill from "./SeletorPill";

type Props = {
  pasta: string | null;
  titulo: string;
  podeVoltar: boolean;
  podeAvancar: boolean;
  modo: "edicao" | "leitura";
  edicaoDisponivel: boolean;
  aoVoltar(): void;
  aoAvancar(): void;
  aoAlternarModo(): void;
  aoCopiarLigacao(): void;
  aoAbrirEmNovaAba(): void;
  aoPerguntarAoBimo(): void;
};

const interacao = "min-h-10 rounded-full transition-[color,background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50";
const explicacao = "A edição ainda não está disponível: as notas estão em modo somente leitura.";

export default function BarraDeNavegacao(props: Props) {
  const [menuAberto, definirMenuAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const opcoes = [
    { rotulo: "Abrir em nova aba", acao: props.aoAbrirEmNovaAba },
    { rotulo: "Copiar ligação", acao: props.aoCopiarLigacao },
    { rotulo: "Perguntar ao Bimo", acao: props.aoPerguntarAoBimo },
  ];

  useEffect(() => {
    if (!menuAberto) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function aoClicarFora(evento: PointerEvent) {
      if (evento.target instanceof Node && !menu.current?.contains(evento.target) && !botao.current?.contains(evento.target)) definirMenuAberto(false);
    }
    document.addEventListener("pointerdown", aoClicarFora);
    return () => document.removeEventListener("pointerdown", aoClicarFora);
  }, [menuAberto]);

  function fecharMenu() { definirMenuAberto(false); botao.current?.focus(); }

  return (
    <div className="relative flex flex-wrap items-center gap-1 border-b border-borda bg-painel px-2 py-1.5 text-controle md:flex-nowrap md:px-3">
      <button type="button" aria-label="Voltar" disabled={!props.podeVoltar} onClick={props.aoVoltar} className={`w-10 ${interacao}`}>←</button>
      <button type="button" aria-label="Avançar" disabled={!props.podeAvancar} onClick={props.aoAvancar} className={`w-10 ${interacao}`}>→</button>
      <nav aria-label="Caminho da nota" className="min-w-0 flex-1 truncate px-2 text-suave">
        {props.pasta && <span className="hidden md:inline">{props.pasta} / </span>}<strong className="font-semibold text-texto">{props.titulo}</strong>
      </nav>
      <div title={!props.edicaoDisponivel ? explicacao : undefined}>
        <SeletorPill opcoes={[{ valor: "edicao", rotulo: "Edição" }, { valor: "leitura", rotulo: "Leitura" }]} valor={props.modo} rotulo="Modo do editor" onChange={(modo) => {
          if (modo !== props.modo && (modo !== "edicao" || props.edicaoDisponivel)) props.aoAlternarModo();
        }} />
      </div>
      <button ref={botao} type="button" aria-label="Mais opções" aria-haspopup="menu" aria-expanded={menuAberto} aria-controls={menuAberto ? id : undefined} onClick={() => definirMenuAberto(!menuAberto)} className={`w-10 ${interacao}`}>⋯</button>
      {menuAberto && <div ref={menu} id={id} role="menu" aria-label="Mais opções" onKeyDown={(evento) => {
        if (evento.key === "Escape") { evento.preventDefault(); fecharMenu(); }
        if (evento.key === "Tab") { fecharMenu(); return; }
        const itens = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
        const destinos: Record<string, number> = { ArrowDown: (atual + 1) % itens.length, ArrowUp: (atual - 1 + itens.length) % itens.length, Home: 0, End: itens.length - 1 };
        if (evento.key in destinos) { evento.preventDefault(); itens[destinos[evento.key]]?.focus(); }
      }} className="absolute top-full right-2 z-20 min-w-52 rounded-bloco border border-borda bg-painel p-1 shadow-foco motion-safe:animate-entrada">
        {opcoes.map(({ rotulo, acao }) => <button key={rotulo} type="button" role="menuitem" tabIndex={-1} onClick={() => { fecharMenu(); acao(); }} className={`block w-full px-3 text-left ${interacao}`}>{rotulo}</button>)}
      </div>}
    </div>
  );
}
