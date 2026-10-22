"use client";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import BimoPensando from "./BimoPensando";
import type { ResumoDeNota, NotaCompleta } from "@/lib/repositorio-de-notas/tipos";
import type { MetadadosWiki } from "@/lib/wiki/tipos";
import type { obterIndiceWiki } from "@/lib/wiki/servico";

type Pagina = Awaited<ReturnType<typeof obterIndiceWiki>>[number];
type Detalhe = { nota: NotaCompleta; estado: string; evidencias: MetadadosWiki };
type Indice = { paginas: Pagina[]; notas: ResumoDeNota[]; disponivel: boolean };
async function buscarIndice(sinal?: AbortSignal): Promise<Indice> {
  const resposta = await fetch("/api/wiki", { cache: "no-store", signal: sinal });
  if (!resposta.ok) throw new Error("Falha ao carregar o índice.");
  return resposta.json();
}
const botao = "min-h-10 rounded-full border border-borda px-4 text-controle transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96] disabled:opacity-50";
const estados: Record<string, string> = { atualizada: "Atualizada", desatualizada: "As notas de origem mudaram", edicao_manual: "Edição manual protegida" };

export default function WikiViva() {
  const [paginas, definirPaginas] = useState<Pagina[]>([]);
  const [notas, definirNotas] = useState<ResumoDeNota[]>([]);
  const [selecionadas, definirSelecionadas] = useState<string[]>([]);
  const [titulo, definirTitulo] = useState("");
  const [alvo, definirAlvo] = useState<Pagina | null>(null);
  const [detalhe, definirDetalhe] = useState<Detalhe | null>(null);
  const [erro, definirErro] = useState(""); const [aviso, definirAviso] = useState("");
  const [ocupado, definirOcupado] = useState(false); const [disponivel, definirDisponivel] = useState(false);
  const [filtro, definirFiltro] = useState("");
  const aplicarIndice = useCallback((dados: Indice) => {
    definirPaginas(dados.paginas); definirNotas(dados.notas); definirDisponivel(dados.disponivel); definirErro("");
  }, []);
  const falhaNoIndice = () => definirErro("Não consegui carregar a Wiki Viva. Confira se ela está habilitada e tente novamente.");
  async function carregar() { try { aplicarIndice(await buscarIndice()); } catch { falhaNoIndice(); } }
  useEffect(() => {
    const controle = new AbortController();
    void buscarIndice(controle.signal).then((dados) => { if (!controle.signal.aborted) aplicarIndice(dados); }).catch(() => {
      if (!controle.signal.aborted) definirErro("Não consegui carregar a Wiki Viva. Confira se ela está habilitada e tente novamente.");
    });
    return () => controle.abort();
  }, [aplicarIndice]);
  async function abrir(id: string) {
    try {
      const resposta = await fetch(`/api/wiki?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!resposta.ok) throw new Error();
      definirDetalhe(await resposta.json());
    } catch { definirErro("Não consegui abrir a página agora."); }
  }
  return <main className="mx-auto flex h-full max-w-5xl flex-col gap-6 overflow-y-auto p-4 text-texto md:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-titulo-nota">Wiki Viva</h1><Link href="/" className={botao}>Voltar às notas</Link></header>
    <p className="text-pretty">Escolha notas livres para construir uma síntese com referências. Cada compilação usa o modelo uma vez. As notas pessoais permanecem preservadas.</p>
    {erro && <div role="alert"><p>{erro}</p><button type="button" onClick={() => void carregar()} className={botao}>Tentar novamente</button></div>}
    {aviso && <p role="status">{aviso}</p>}
    {ocupado && <BimoPensando texto="Conectando o conhecimento das notas…" />}
    <form aria-busy={ocupado} className="flex flex-col gap-3 rounded-bloco border border-borda bg-painel p-4" onSubmit={async (e) => {
      e.preventDefault(); if (ocupado || !disponivel) return;
      definirOcupado(true); definirErro(""); definirAviso("");
      try {
        const resposta = await fetch("/api/wiki", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo, fontes: selecionadas, ...(alvo ? { paginaId: alvo.id, revisaoBase: alvo.revisao } : {}) }) });
        const dados = await resposta.json();
        if (!resposta.ok) { definirErro(typeof dados.erro === "string" ? dados.erro : "Não consegui compilar agora."); return; }
        definirAviso(dados.tipo === "sem_mudanca" ? "As fontes continuam iguais. Não foi necessário gerar novamente." : "Página salva na wiki e disponível na busca de notas.");
        definirAlvo(null); definirSelecionadas([]); definirTitulo(""); definirDetalhe(null); await carregar();
      } catch { definirErro("Não consegui compilar agora. Confira o índice antes de repetir: uma gravação pode ter sido concluída."); }
      finally { definirOcupado(false); }
    }}>
      <h2 className="text-secao">{alvo ? "Enriquecer página" : "Nova página de conhecimento"}</h2>
      <label>Título da página<input aria-label="Título da página" required maxLength={200} value={titulo} disabled={ocupado || Boolean(alvo)} onChange={(e) => definirTitulo(e.target.value)} className="block min-h-10 w-full rounded-bloco border border-borda bg-fundo px-3" /></label>
      <p>Selecione até dez notas. Ao enriquecer, as fontes anteriores são preservadas. Edições manuais da página bloqueiam a recompilação.</p>
      <label>Filtrar notas<input value={filtro} onChange={(e) => definirFiltro(e.target.value)} className="block min-h-10 w-full rounded-bloco border border-borda bg-fundo px-3" /></label>
      <fieldset disabled={ocupado} className="max-h-64 overflow-y-auto"><legend>Notas de origem</legend>
        {notas.filter((n) => `${n.pasta ?? ""} ${n.titulo}`.toLocaleLowerCase("pt-BR").includes(filtro.toLocaleLowerCase("pt-BR"))).map((n) => <label key={n.id} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={selecionadas.includes(n.id)} onChange={(e) => definirSelecionadas((ids) => e.target.checked ? [...ids, n.id] : ids.filter((id) => id !== n.id))} />{n.pasta ? `${n.pasta} / ` : ""}{n.titulo}</label>)}
      </fieldset>
      <div className="flex flex-wrap gap-2"><button disabled={ocupado || !disponivel || !selecionadas.length || selecionadas.length > 10} className={botao}>{ocupado ? "Compilando…" : "Compilar página"}</button>
        {alvo && <button type="button" disabled={ocupado} className={botao} onClick={() => { definirAlvo(null); definirTitulo(""); definirSelecionadas([]); }}>Cancelar atualização</button>}</div>
    </form>
    <section aria-label="Índice da wiki" className="flex flex-col gap-3"><h2 className="text-secao">Páginas de conhecimento</h2>
      {!paginas.length && <p>A wiki ainda não possui páginas.</p>}
      {paginas.map((p) => <article key={p.id} className="rounded-bloco border border-borda bg-painel p-4"><h3>{p.titulo}</h3><p>{estados[p.estado] ?? p.estado} · {p.fontes} nota(s) de origem</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" className={botao} onClick={() => void abrir(p.id)}>Ler {p.titulo} e evidências</button><button type="button" disabled={ocupado || p.estado === "edicao_manual"} className={botao} onClick={() => { definirAlvo(p); definirTitulo(p.titulo); definirSelecionadas(p.origens); definirAviso(""); }}>Enriquecer {p.titulo}</button></div></article>)}
    </section>
    {detalhe && <section aria-label="Página e evidências" className="rounded-bloco border border-borda bg-painel p-4"><p>{estados[detalhe.estado] ?? detalhe.estado}</p><ReactMarkdown>{detalhe.nota.conteudo}</ReactMarkdown><h2 className="text-secao">Evidências verificadas</h2>{detalhe.evidencias.afirmacoes.map((a, i) => <div key={i} className="my-3"><p>{a.texto}</p>{a.evidencias.map((e, j) => <blockquote key={j} className="border-l border-borda pl-3"><p>{e.citacao}</p><p>Nota {detalhe.evidencias.fontes.find((f) => f.id === e.fonteId)?.titulo}, revisão {detalhe.evidencias.fontes.find((f) => f.id === e.fonteId)?.revisao}.</p></blockquote>)}</div>)}
      {detalhe.evidencias.fontes.map((fonte) => <details key={fonte.id} className="my-3"><summary className="min-h-10 cursor-pointer">Ver contexto de {fonte.titulo}, revisão {fonte.revisao}</summary><div className="whitespace-pre-wrap break-words">{fonte.conteudo}</div></details>)}
    </section>}
  </main>;
}
