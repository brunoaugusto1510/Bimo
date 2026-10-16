"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { contarPalavras, extrairTitulos } from "@/lib/markdown-da-nota";
import { criarResolvedor } from "@/lib/ligacoes";
import { idAtual, type AbaDeNota as EstadoDaAbaDeNota } from "@/lib/espaco-de-trabalho/estado";
import { useLigacoes, useNota } from "@/lib/espaco-de-trabalho/usar-nota";
import type { NotaParaArvore } from "@/lib/arvore-de-notas";
import type { IdDeNota } from "@/lib/types";
import BarraDeNavegacao from "./BarraDeNavegacao";
import BarraDeStatus from "./BarraDeStatus";
import PainelLateralDaNota from "./PainelLateralDaNota";
import VisaoDaNota from "./VisaoDaNota";
import EditorDeNota from "./EditorDeNota";
import ControlesDaEdicao from "./ControlesDaEdicao";
import { useEdicaoDeNota } from "@/lib/espaco-de-trabalho/usar-edicao-de-nota";

type Props = {
  ativa?: boolean;
  aoMudarPendencia?: (id: IdDeNota, pendente: boolean) => void;
  aba: EstadoDaAbaDeNota;
  /** Todas as notas, por id: dão o título e a pasta enquanto a nota ainda carrega. */
  notas: ReadonlyMap<IdDeNota, NotaParaArvore>;
  aoVoltar: () => void;
  aoAvancar: () => void;
  aoAlternarModo: () => void;
  aoAbrirNota: (id: IdDeNota, opcoes: { novaAba: boolean }) => void;
  aoCriarNota: (titulo: string) => void;
  aoPerguntarAoBimo: (id: IdDeNota) => void;
};

const formatar = (numero: number) => numero.toLocaleString("pt-BR");
const SEM_DESCARTES: ReadonlySet<IdDeNota> = new Set();
/** Quanto tempo um aviso passageiro ("Ligação copiada") fica na barra de status. */
const DURACAO_DO_AVISO_MS = 3000;

/**
 * O que uma aba de nota mostra: a navegação (voltar, caminho, modo), a nota, o painel
 * lateral (ligações, estrutura, sugestão) e a barra de status. Carrega a nota e as
 * ligações dela por conta própria; a nota abre primeiro e o painel preenche depois.
 *
 * A aba não remonta ao navegar para outra nota (o foco fica no botão que a pessoa acionou,
 * e voltar de novo continua possível pelo teclado): o que muda é o `id`, e os hooks refazem
 * o pedido. Quem usa leitor de tela é avisado da nova nota por uma região de status.
 */
export default function AbaDeNota({
  aba,
  notas,
  aoVoltar,
  aoAvancar,
  aoAlternarModo,
  aoAbrirNota,
  aoCriarNota,
  aoPerguntarAoBimo,
  ativa = true,
  aoMudarPendencia,
}: Props) {
  const id = idAtual(aba);
  const pendenciaAtual = useRef(false);
  const nota = useNota(id, ativa, () => !pendenciaAtual.current);
  const ligacoes = useLigacoes(ativa ? id : null);
  const recarregarNota = nota.recarregar;
  const recarregarLigacoes = ligacoes.recarregar;
  const timerLigacoes = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ultimoConjunto = useRef<string | undefined>(undefined);
  const conjunto = (texto: string) => JSON.stringify([...new Set(texto.match(/\[\[[^\]]+\]\]/g) ?? [])].sort());
  const edicao = useEdicaoDeNota(id, nota.dados, ativa && aba.modo === "edicao", (salva, checkpoint) => {
    const novo = conjunto(salva.conteudo);
    const anterior = ultimoConjunto.current ?? conjunto(nota.dados?.nota.conteudo ?? "");
    ultimoConjunto.current = novo;
    if (ativa && (checkpoint || novo !== anterior)) {
      clearTimeout(timerLigacoes.current);
      timerLigacoes.current = setTimeout(ligacoes.recarregar, 600);
    }
  });
  useEffect(() => { pendenciaAtual.current = edicao.pendente; }, [edicao.pendente]);
  useEffect(() => { ultimoConjunto.current = undefined; return () => clearTimeout(timerLigacoes.current); }, [id, ativa]);
  useEffect(() => {
    function aoAgente(evento: Event) {
      if (ativa && !pendenciaAtual.current && (evento as CustomEvent<{ id: string }>).detail.id === id) { recarregarNota(); recarregarLigacoes(); }
    }
    window.addEventListener("bimo:nota-alterada-pelo-agente", aoAgente);
    return () => window.removeEventListener("bimo:nota-alterada-pelo-agente", aoAgente);
  }, [ativa, id, recarregarNota, recarregarLigacoes]);
  const idRecuperacao = useId();
  const [focarAoEntrar, definirFocarAoEntrar] = useState(false);
  const [anuncioManual, definirAnuncioManual] = useState(0);
  useEffect(() => { const timer = setTimeout(() => definirFocarAoEntrar(false), 0); return () => clearTimeout(timer); }, [ativa, aba.modo, id]);
  async function salvarAgora() { await edicao.forcar({ checkpoint: true }); definirAnuncioManual((n) => n + 1); }
  useEffect(() => { aoMudarPendencia?.(id, edicao.pendente); }, [id, edicao.pendente, aoMudarPendencia]);
  const artigo = useRef<HTMLElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const moldura = useRef<HTMLDivElement>(null);
  const navegacao = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ajustar = () => moldura.current?.style.setProperty("--altura-navegacao", `${navegacao.current?.offsetHeight ?? 56}px`);
    ajustar();
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(ajustar);
    if (navegacao.current) observador?.observe(navegacao.current);
    return () => observador?.disconnect();
  }, []);

  // O que foi "descartado" na sugestão do Bimo vale só para a nota em que foi descartado.
  const [descartes, setDescartes] = useState<{ id: IdDeNota; ids: ReadonlySet<IdDeNota> }>({ id, ids: SEM_DESCARTES });
  const sugestoesDescartadas = descartes.id === id ? descartes.ids : SEM_DESCARTES;
  const [aviso, setAviso] = useState<string | null>(null);

  const resolver = useMemo(() => criarResolvedor([...notas.values()]), [notas]);
  const resumo = notas.get(id);
  const titulo = nota.dados?.nota.titulo ?? resumo?.titulo ?? "Nota";
  const pasta = nota.dados?.nota.pasta ?? resumo?.pasta ?? null;
  const carregada = nota.dados !== undefined;

  const conteudo = edicao.texto;
  const estrutura = useMemo(() => extrairTitulos(conteudo), [conteudo]);
  const entradas = ligacoes.dados?.ligacoes.entrada ?? [];
  const saidas = ligacoes.dados?.ligacoes.saida ?? [];
  const sugestao = ligacoes.dados?.mencoesSemLigacao.find((mencao) => !sugestoesDescartadas.has(mencao.id)) ?? null;

  // Conexões são notas ligadas a esta, nos dois sentidos: quem a cita e é citada por ela conta uma vez só.
  const conexoes =
    ligacoes.estado === "pronto"
      ? new Set([...entradas.map((entrada) => entrada.id), ...saidas.flatMap((destino) => (destino.tipo === "nota" ? [destino.id] : []))]).size
      : null;
  const escrita = nota.dados?.capacidades.escrita ?? false;

  // A aba do navegador acompanha a nota aberta.
  useEffect(() => {
    if (!carregada || !ativa) return;
    const anterior = document.title;
    document.title = `${titulo} · Bimo`;
    return () => {
      document.title = anterior;
    };
  }, [carregada, titulo, ativa]);

  // Outra nota na mesma aba começa lida do topo.
  useEffect(() => {
    rolagem.current?.scrollTo?.({ top: 0 });
  }, [id]);

  // Um aviso passageiro some sozinho.
  useEffect(() => {
    if (aviso === null) return;
    const temporizador = setTimeout(() => setAviso(null), DURACAO_DO_AVISO_MS);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  function irParaLinha(linha: number) {
    const editor = artigo.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (editor) {
      const inicio = conteudo.split("\n").slice(0, linha - 1).join("\n").length + (linha > 1 ? 1 : 0);
      editor.focus(); editor.setSelectionRange(inicio, inicio); return;
    }
    const titulo = artigo.current?.querySelector<HTMLElement>(`[data-linha="${linha}"]`);
    if (!titulo) return;
    titulo.scrollIntoView?.({ block: "start" });
    // Só rolar deixaria o foco no botão da estrutura; quem usa teclado ou leitor de tela segue o texto.
    titulo.tabIndex = -1;
    titulo.focus({ preventScroll: true });
  }

  function copiarLigacao() {
    // `[[Título]]` basta quando o título leva só a esta nota; com repetição, o caminho desfaz a dúvida.
    const unico = resolver(titulo, null);
    const alvo = unico.tipo === "resolvida" && unico.nota.id === id ? titulo : `${pasta ? `${pasta}/` : ""}${titulo}`;
    const area = navigator.clipboard;
    if (!area) return setAviso("Não consegui copiar a ligação");
    area.writeText(`[[${alvo}]]`).then(
      () => setAviso("Ligação copiada"),
      () => setAviso("Não consegui copiar a ligação"),
    );
  }

  return (
    <div ref={moldura} className="absolute inset-0 z-10 flex flex-col bg-painel motion-safe:animate-entrada">
      {/* Uma região de status para leitor de tela: sem ela, trocar de nota na mesma aba não é anunciado. */}
      <p role="status" className="sr-only">
        {carregada ? `Nota aberta: ${titulo}` : ""}
      </p>

      {/*
        Em tela larga: a nota e o painel lateral rolam cada um no seu lado. Em tela estreita: tudo
        é uma coluna só que rola junto — a navegação fica grudada no topo e o painel (ligações,
        estrutura) vem depois da nota, em vez de sumir.
      */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div ref={navegacao} className="sticky top-0 z-10 bg-painel lg:static">
          <BarraDeNavegacao
            pasta={pasta}
            titulo={titulo}
            podeVoltar={aba.historico.indice > 0}
            podeAvancar={aba.historico.indice < aba.historico.pilha.length - 1}
            modo={aba.modo}
            edicaoDisponivel={escrita}
            aoVoltar={aoVoltar}
            aoAvancar={aoAvancar}
            aoAlternarModo={() => { definirFocarAoEntrar(aba.modo === "leitura"); aoAlternarModo(); }}
            aoCopiarLigacao={copiarLigacao}
            aoAbrirEmNovaAba={() => aoAbrirNota(id, { novaAba: true })}
            aoPerguntarAoBimo={() => aoPerguntarAoBimo(id)}
          />
        </div>

        {/* `tabIndex` 0: sem ele, as setas e o PageDown só rolam a nota se o foco já estiver dentro dela. */}
        <div
          ref={rolagem}
          role="region"
          aria-label="Conteúdo da nota"
          tabIndex={0}
          className="lg:min-h-0 lg:overflow-y-auto"
        >
          {nota.estado === "carregando" && (
            <p role="status" className="px-8 py-10 text-sm text-suave">
              Carregando…
            </p>
          )}

          {nota.estado === "erro" && (
            <div role="alert" className="mx-auto max-w-[720px] px-8 py-10">
              <p className="text-sm text-texto">
                {nota.status === 404 ? "Esta nota não existe mais." : nota.status === 401 ? "Sua sessão expirou. Entre de novo." : nota.mensagem}
              </p>
              {nota.status === 401 ? (
                <a
                  href="/login"
                  className="mt-3 inline-flex min-h-10 items-center rounded-full bg-destaque px-4 text-controle font-semibold text-sobre-destaque transition-[background-color,transform] hover:bg-destaque-hover motion-safe:active:scale-[0.96]"
                >
                  Entrar de novo
                </a>
              ) : nota.status !== 404 ? (
                <button
                  type="button"
                  onClick={nota.recarregar}
                  className="mt-3 min-h-10 rounded-full border border-borda px-4 text-controle font-semibold text-texto transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96]"
                >
                  Tentar de novo
                </button>
              ) : null}
            </div>
          )}

          <ControlesDaEdicao conflito={edicao.estado === "conflito"} recuperado={edicao.rascunhoRecuperado}
            recusado={edicao.estado === "recusado"} mensagem={edicao.mensagem} idAviso={idRecuperacao} ativo={ativa}
            editando={ativa && escrita && aba.modo === "edicao"} salvar={salvarAgora}
            resolver={edicao.resolverConflito} aoResolver={() => {
              const alvo = rolagem.current?.querySelector<HTMLElement>("textarea") ?? rolagem.current?.querySelector<HTMLElement>("h1") ?? rolagem.current;
              alvo?.focus({ preventScroll: true });
            }} />
          {edicao.avisoLocal && <p role="alert" className="px-5 py-3 text-texto">{edicao.avisoLocal}</p>}
          {nota.dados && (
            <VisaoDaNota
              ref={artigo}
              nota={{ ...(edicao.nota ?? nota.dados.nota), conteudo }}
              conexoes={conexoes}
              resolver={resolver}
              podeCriar={false}
              aoAbrirNota={aoAbrirNota}
              aoCriarNota={aoCriarNota}
            >
              {ativa && escrita && aba.modo === "edicao" ? <EditorDeNota texto={conteudo} titulo={titulo} focarAoEntrar={focarAoEntrar} descricaoRecuperacao={idRecuperacao} aguardandoRecuperacao={edicao.rascunhoRecuperado} aoMudar={edicao.aoMudar} forcar={salvarAgora} /> : undefined}
            </VisaoDaNota>
          )}
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-borda">
          <PainelLateralDaNota
            estado={ligacoes.estado}
            sugestao={sugestao ? { id: sugestao.id, titulo: sugestao.titulo } : null}
            entradas={entradas}
            saidas={saidas}
            estrutura={estrutura}
            // Inserir a ligação no texto precisa da edição (Fase 8a).
            podeInserir={false}
            aoAbrirNota={(destino) => aoAbrirNota(destino, { novaAba: false })}
            aoIrParaLinha={irParaLinha}
            aoInserirSugestao={() => {}}
            aoDescartarSugestao={() => {
              if (sugestao) setDescartes({ id, ids: new Set(sugestoesDescartadas).add(sugestao.id) });
            }}
            aoPerguntarAoBimo={() => aoPerguntarAoBimo(id)}
          />
        </div>
      </div>

      <BarraDeStatus
        estado={escrita ? edicao.estado : undefined} anuncioManual={anuncioManual}
        itens={[
          ...(conexoes === null ? [] : [`${formatar(conexoes)} ${conexoes === 1 ? "conexão" : "conexões"}`]),
          ...(carregada ? [`${formatar(contarPalavras(conteudo))} palavras`, `${formatar(conteudo.length)} caracteres`] : []),
        ]}
        mensagem={(escrita && ["erro", "conflito", "recusado"].includes(edicao.estado) ? null : aviso) ?? (escrita ? ({ salvo: "Salvo", pendente: "Alterações ainda não salvas", salvando: "Salvando…", erro: "Não foi possível salvar. Tentando de novo…", conflito: "Conflito: salvamento pausado. Escolha uma opção no aviso acima da nota.", recusado: edicao.mensagem ?? "Não foi possível salvar. Suas alterações estão preservadas." })[edicao.estado] : "Somente leitura")}
      />
    </div>
  );
}
