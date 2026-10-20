"use client";
import { useEffect, useId, useRef, useState } from "react";
import { normalizarTags } from "@/lib/tags-da-nota";

type Props = {
  /** As tags da coluna da nota: as únicas que se editam aqui. */
  daColuna: readonly string[];
  /** As escritas no texto (`#x`, frontmatter): só leitura, mudam editando o texto. */
  noTexto: readonly string[];
  /** Tags já usadas em outras notas, para completar. */
  sugestoes: readonly string[];
  /** Outra operação da nota está em andamento: o editor espera. */
  ocupado: boolean;
  aoMudar(tags: string[]): Promise<unknown>;
};

/** Os mesmos limites que o servidor aplica (`validacao-de-notas.ts`): avisar aqui evita um "tente de novo" que falharia igual. */
const MAXIMO_DE_TAGS = 30;
const TAMANHO_MAXIMO_DA_TAG = 100;
const CAMPO = Symbol("campo");

const chip = "inline-flex max-w-full items-center gap-1 rounded-tag bg-destaque-suave px-2.5 py-1 text-meta text-destaque-texto";

export default function EditorDeTags({ daColuna, noTexto, sugestoes, ocupado, aoMudar }: Props) {
  const [texto, definirTexto] = useState("");
  const [erro, definirErro] = useState("");
  const [anuncio, anunciar] = useState({ id: 0, texto: "" });
  const [salvando, definirSalvando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const focoApos = useRef<string | typeof CAMPO | null>(null);
  const emVoo = useRef(false);
  const montado = useRef(true);
  const id = useId();
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => {
    if (!anuncio.texto) return;
    const timer = setTimeout(() => anunciar((a) => ({ ...a, texto: "" })), 2000);
    return () => clearTimeout(timer);
  }, [anuncio]);
  useEffect(() => {
    // Depois de remover, o foco vai ao chip vizinho (ou ao campo, se não sobrou nenhum): quem remove várias não recomeça a Tab.
    const alvo = focoApos.current;
    if (alvo === null) return;
    focoApos.current = null;
    (alvo === CAMPO ? campo.current : botoes.current.get(alvo))?.focus({ preventScroll: true });
  }, [daColuna]);

  const bloqueado = salvando || ocupado;
  const emUso = new Set([...daColuna, ...noTexto].map((tag) => tag.toLowerCase()));
  const opcoes = sugestoes.filter((tag) => !emUso.has(tag.toLowerCase()));
  const falar = (aviso: string) => anunciar((a) => ({ id: a.id + 1, texto: aviso }));

  async function aplicar(proximas: string[], aviso: string, falhaPadrao: string) {
    if (emVoo.current) return false;
    if (ocupado) { falar("Aguarde a atualização terminar."); return false; }
    emVoo.current = true; definirSalvando(true);
    try {
      await aoMudar(proximas);
      if (!montado.current) return true;
      definirErro(""); falar(aviso);
      return true;
    } catch (falha) {
      if (montado.current) definirErro(falha instanceof Error ? falha.message : falhaPadrao);
      return false;
    } finally { emVoo.current = false; if (montado.current) definirSalvando(false); }
  }
  async function adicionar() {
    if (ocupado) { falar("Aguarde a atualização terminar."); return; }
    // Uma lista colada ("a, b, c") vira várias tags; cada pedaço passa pela mesma limpeza do servidor.
    const novas = normalizarTags(texto.split(","));
    if (novas.length === 0) { definirTexto(""); return; }
    const comEspaco = novas.find((tag) => /\s/.test(tag));
    if (comEspaco) { definirErro("Tags não podem ter espaços. Use um hífen ou junte as palavras."); return; }
    const longa = novas.find((tag) => tag.length > TAMANHO_MAXIMO_DA_TAG);
    if (longa) { definirErro(`Cada tag pode ter no máximo ${TAMANHO_MAXIMO_DA_TAG} caracteres.`); return; }
    const repetida = novas.map((nova) => daColuna.find((tag) => tag.toLowerCase() === nova.toLowerCase())).find(Boolean);
    if (repetida) { definirErro(`A nota já tem a tag «${repetida}».`); return; }
    const proximas = normalizarTags([...daColuna, ...novas]);
    if (proximas.length > MAXIMO_DE_TAGS) { definirErro(`Use no máximo ${MAXIMO_DE_TAGS} tags.`); return; }
    const aviso = novas.length === 1 ? `Tag «${novas[0]}» adicionada` : `${novas.length} tags adicionadas`;
    if (await aplicar(proximas, aviso, "Não foi possível adicionar a tag.")) definirTexto("");
  }
  async function remover(tag: string) {
    const indice = daColuna.indexOf(tag);
    const vizinha = daColuna[indice + 1] ?? daColuna[indice - 1];
    focoApos.current = vizinha ?? CAMPO;
    if (!(await aplicar(daColuna.filter((outra) => outra !== tag), `Tag «${tag}» removida`, "Não foi possível remover a tag."))) focoApos.current = null;
  }

  return <div>
    <ul className="flex flex-wrap items-center gap-x-1.5 gap-y-3" aria-label="Tags da nota">
      {daColuna.map((tag) => <li key={`c-${tag}`} className={chip}>
        <span className="min-w-0 break-words">#{tag}</span>
        <button type="button" ref={(botao) => { if (botao) botoes.current.set(tag, botao); else botoes.current.delete(tag); }}
          aria-label={`Remover tag ${tag}`} aria-disabled={bloqueado || undefined}
          onClick={() => { if (!bloqueado) void remover(tag); else if (ocupado) falar("Aguarde a atualização terminar."); }}
          className="relative inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full text-destaque-texto transition-[background-color,transform] after:absolute after:-inset-x-2 after:-inset-y-1.5 after:content-[''] hover:bg-destaque-suave-borda motion-safe:active:scale-[0.96] aria-disabled:opacity-60">×</button>
      </li>)}
      {noTexto.map((tag) => <li key={`t-${tag}`} className={chip}>
        <span className="min-w-0 break-words">#{tag}</span>
        <span>no texto<span className="sr-only">; para remover, edite o texto da nota</span></span>
      </li>)}
      {daColuna.length === 0 && noTexto.length === 0 && <li className="text-texto">Sem tags</li>}
    </ul>
    <input ref={campo} aria-label="Adicionar tag" aria-invalid={!!erro} aria-busy={bloqueado} readOnly={bloqueado}
      aria-describedby={`${id}-dica${erro ? ` ${id}` : ""}`} list={`${id}-sugestoes`} autoComplete="off" enterKeyHint="done" placeholder="Adicionar tag" value={texto}
      onChange={(evento) => { definirTexto(evento.target.value); definirErro(""); }}
      onKeyDown={(evento) => {
        if (evento.nativeEvent.isComposing || evento.keyCode === 229) return;
        if (evento.key === "Enter" || evento.key === ",") { evento.preventDefault(); void adicionar(); }
        if (evento.key === "Escape" && texto) { evento.preventDefault(); evento.stopPropagation(); definirTexto(""); definirErro(""); }
      }}
      className="mt-2 min-h-10 w-full rounded-bloco border border-borda bg-painel px-2 text-controle text-texto read-only:bg-painel-alt placeholder:text-texto/75 focus-visible:border-destaque" />
    <datalist id={`${id}-sugestoes`}>{opcoes.map((tag) => <option key={tag} value={tag} />)}</datalist>
    <span id={`${id}-dica`} className="sr-only">Enter ou vírgula adiciona. Esc limpa o campo.</span>
    <p id={id} role="alert" className="mt-1 text-meta text-erro">{erro}</p>
    <p role="status" className="sr-only"><span key={anuncio.id}>{anuncio.texto}</span></p>
  </div>;
}
