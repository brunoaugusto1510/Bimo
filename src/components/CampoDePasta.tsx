"use client";
import { useEffect, useId, useRef, useState } from "react";
import { normalizarPasta } from "@/lib/caminho-da-nota";

type Resultado = { notasReescritas?: number; pasta?: string | null } | void;

type Props = {
  pasta: string | null;
  /** As pastas que já existem (com as pastas-pai), para sugerir; texto livre também vale (cria a pasta). */
  pastas: readonly string[];
  /** Outra operação da nota (renomear, tags) está em andamento: o campo espera. */
  ocupado: boolean;
  aoMudar(pasta: string | null): Promise<Resultado>;
};

const RAIZ = "Raiz";

const ehRaiz = (texto: string) => texto.trim().toLowerCase() === RAIZ.toLowerCase();

/**
 * A pasta da nota no painel de propriedades: Enter (ou o botão Mover) move; Esc desfaz. Sair do campo
 * não descarta o que foi digitado. Mover uma nota muda o "Pasta/Título" das ligações com caminho; o
 * aviso, visível, diz quantas notas foram reescritas.
 */
export default function CampoDePasta({ pasta, pastas, ocupado, aoMudar }: Props) {
  const [texto, definirTexto] = useState(pasta ?? RAIZ);
  const [erro, definirErro] = useState("");
  const [aviso, definirAviso] = useState({ id: 0, texto: "" });
  const [salvando, definirSalvando] = useState(false);
  const digitando = useRef(false);
  const emVoo = useRef(false);
  const montado = useRef(true);
  const id = useId();
  const atual = pasta ?? RAIZ;
  // "Raiz" só vale como a raiz quando não existe uma pasta de verdade com esse nome.
  const raizReservada = !pastas.some(ehRaiz);
  const destino = raizReservada && ehRaiz(texto) ? null : normalizarPasta(texto);
  const podeMover = destino !== pasta;
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => {
    // Uma mudança externa (outra aba, o agente) só entra quando não há digitação em curso.
    if (!digitando.current && !emVoo.current) definirTexto(atual);
  }, [atual]);

  function avisar(texto: string) { definirAviso((a) => ({ id: a.id + 1, texto })); }
  function desfazer() { digitando.current = false; definirTexto(atual); definirErro(""); }

  async function confirmar() {
    if (emVoo.current) return;
    if (ocupado) { avisar("Aguarde a atualização terminar."); return; }
    if (!podeMover) { desfazer(); return; }
    emVoo.current = true; definirSalvando(true); definirErro(""); avisar("");
    try {
      const resultado = await aoMudar(destino);
      if (!montado.current) return;
      // O servidor pode ter adotado a grafia de uma pasta que já existe ("projetos" → "Projetos").
      const gravada = resultado && resultado.pasta !== undefined ? resultado.pasta : destino;
      const reescritas = (resultado && resultado.notasReescritas) ?? 0;
      const sufixo = reescritas === 1 ? "; 1 nota teve a ligação atualizada" : reescritas > 0 ? `; ${reescritas} notas tiveram ligações atualizadas` : "";
      digitando.current = false; definirTexto(gravada ?? RAIZ);
      avisar(`${gravada === null ? "Pasta alterada para a raiz" : `Pasta alterada para «${gravada}»`}${sufixo}`);
    } catch (falha) {
      if (montado.current) definirErro(falha instanceof Error ? falha.message : "Não foi possível mover a nota.");
    } finally { emVoo.current = false; if (montado.current) definirSalvando(false); }
  }

  const bloqueado = salvando || ocupado;
  return <div>
    <div className="flex items-start gap-2">
      <input aria-label="Pasta" aria-invalid={!!erro} aria-busy={bloqueado} readOnly={bloqueado}
        aria-describedby={`${id}-dica${erro ? ` ${id}` : ""}`} list={`${id}-pastas`} autoComplete="off" enterKeyHint="done" value={texto}
        onChange={(evento) => { digitando.current = true; definirTexto(evento.target.value); avisar(""); }}
        // Selecionar tudo deixa o primeiro caractere digitado substituir a pasta: sem isso a lista só mostra as que combinam com ela.
        onFocus={(evento) => { evento.currentTarget.select(); avisar(""); }}
        onKeyDown={(evento) => {
          if (evento.nativeEvent.isComposing || evento.keyCode === 229) return;
          if (evento.key === "Enter") { evento.preventDefault(); void confirmar(); }
          if (evento.key === "Escape" && !emVoo.current) {
            evento.preventDefault(); evento.stopPropagation();
            if (podeMover) avisar("Alteração da pasta descartada");
            desfazer();
          }
        }}
        className="min-h-10 min-w-0 flex-1 rounded-bloco border border-borda bg-painel px-2 text-controle text-texto read-only:bg-painel-alt focus-visible:border-destaque" />
      <button type="button" aria-disabled={!podeMover || bloqueado || undefined} onClick={() => { if (podeMover && !bloqueado) void confirmar(); }}
        className="min-h-10 shrink-0 rounded-full bg-destaque px-4 text-controle font-semibold text-sobre-destaque transition-[background-color,transform] hover:bg-destaque-hover motion-safe:active:scale-[0.96] aria-disabled:bg-desabilitado aria-disabled:text-desabilitado-texto aria-disabled:hover:bg-desabilitado">
        Mover
      </button>
    </div>
    <datalist id={`${id}-pastas`}>
      {raizReservada && <option value={RAIZ} />}
      {pastas.map((nome) => <option key={nome} value={nome} />)}
    </datalist>
    <span id={`${id}-dica`} className="sr-only">Enter ou o botão Mover move a nota. Esc descarta o que foi digitado. Escolha uma pasta da lista ou digite uma nova; Raiz tira a nota das pastas.</span>
    <p id={id} role="alert" className="mt-1 text-meta text-erro">{erro}</p>
    <p role="status" className={aviso.texto ? "mt-1 text-meta text-texto" : "sr-only"}><span key={aviso.id}>{aviso.texto}</span></p>
  </div>;
}
