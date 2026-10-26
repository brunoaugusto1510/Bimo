"use client";
import { mesclarNotasLocais, podarNotasLocais, type NotasLocais } from "@/lib/espaco-de-trabalho/notas-locais";
import { useCriacaoDeNota, type FocoPedido } from "@/lib/espaco-de-trabalho/usar-criacao-de-nota";
import type { CapacidadesDoRepositorio } from "@/lib/repositorio-de-notas/tipos";
import type { NotaParaArvore } from "@/lib/arvore-de-notas";
import AtualizadorDasNotas from "./AtualizadorDasNotas";
import { esquecerSemente } from "@/lib/cliente-de-notas";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AlternadorDeTema from "@/components/AlternadorDeTema";
import BarraDoGrafo from "@/components/BarraDoGrafo";
import BarraLateral from "@/components/BarraLateral";
import CartaoDeFoco from "@/components/CartaoDeFoco";
import Chat from "@/components/Chat";
import EspacoDeTrabalho from "@/components/EspacoDeTrabalho";
import GrafoDeFundo, { type ControleDoGrafo } from "@/components/GrafoDeFundo";
import MarcaBimo from "@/components/MarcaBimo";
import PaletaIrParaNota from "@/components/PaletaIrParaNota";
import SeletorPill from "@/components/SeletorPill";
import { construirArvore, indexarNotas } from "@/lib/arvore-de-notas";
import { combinaAtalho } from "@/lib/atalhos";
import { grupoDaPasta } from "@/lib/caminho-da-nota";
import { ABA_DO_GRAFICO, abaAtiva, idAtual } from "@/lib/espaco-de-trabalho/estado";
import { useEspacoDeTrabalho } from "@/lib/espaco-de-trabalho/usar-espaco-de-trabalho";
import { calcularGraus } from "@/lib/fisica-do-grafo";
import type { Grafo } from "@/lib/grafo-de-notas";
import { encerrarRastro, iniciarRastro, registrarPasso, type PassoDoAgente, type Rastro } from "@/lib/rastro-do-agente";
import { marcasDoRastro, resumoDoRastro } from "@/lib/rastro-na-interface";
import type { RealceNoGrafo } from "@/lib/realce-no-grafo";
import type { IdDeNota, ItemDeNotas } from "@/lib/types";
import PainelDaWiki from "./wiki/PainelDaWiki";
import NeuronioAberto from "./wiki/NeuronioAberto";
import { chip } from "./wiki/estilos";
import { neuroniosDoFiltro, type FiltroDoCerebro } from "./wiki/filtro-do-cerebro";
import { useConsultaWiki } from "./wiki/usar-consulta-wiki";
import type { ResumoDoCerebro } from "@/lib/wiki/cliente";
import { useFocoDoPainel } from "./wiki/usar-foco-do-painel";

type Props = {
  /** Já vem pronto do servidor — este componente só cuida da interatividade. */
  itens: ItemDeNotas[];
  grafo: Grafo;
  aviso?: string;
  capacidades?: CapacidadesDoRepositorio;
};

/**
 * Bimo: conversa com o agente, com o grafo só de pano de fundo.
 * Notas: o espaço de trabalho — abas (o Gráfico, que dá para arrastar, aproximar e clicar,
 * mais as notas abertas), a paleta Ctrl+O e o painel lateral de cada nota.
 */
type Modo = "bimo" | "notas";

const OPCOES_DE_MODO = [
  { valor: "bimo", rotulo: "Bimo" },
  { valor: "notas", rotulo: "Notas" },
] as const;

const SOMENTE_LEITURA = { escrita: false, datas: false };

/** Na aba Bimo a conversa fica embaixo: o cérebro é enquadrado no resto da altura, em cima. */
const RESERVA_DA_CONVERSA = 0.45;

export default function PaginaPrincipal({ itens: itensIniciais, grafo: grafoInicial, aviso: avisoInicial, capacidades: capacidadesIniciais = SOMENTE_LEITURA }: Props) {
  const [atualizacao, definirAtualizacao] = useState<{ origem: Props["itens"]; dados: import("@/lib/servico-de-notas").DadosDaPagina } | null>(null);
  const { itens, grafo, aviso, capacidades } = atualizacao?.origem === itensIniciais ? atualizacao.dados : { itens: itensIniciais, grafo: grafoInicial, aviso: avisoInicial, capacidades: capacidadesIniciais };
  const [modo, setModo] = useState<Modo>("bimo");
  const [painelWiki, definirPainelWiki] = useState<"cerebro" | "diario" | null>(null);
  const [neuronioAberto, abrirNeuronioId] = useState<string | null>(null);
  const focoNeuronio = useFocoDoPainel(neuronioAberto);
  const [filtroDoCerebro, filtrarCerebro] = useState<FiltroDoCerebro>("tudo");
  const neuronios = useMemo(() => new Set(grafo.nos.flatMap((n) => n.tipo === "nota" && n.neuronio ? [n.id] : [])), [grafo.nos]);
  // Com o cérebro aberto consulta mesmo sem neurônio no grafo: é assim que o primeiro, nascido em segundo plano, é descoberto.
  const cerebroWiki = useConsultaWiki<ResumoDoCerebro>(neuronios.size || painelWiki ? "/api/wiki/cerebro" : null);
  // Um neurônio que nasceu em segundo plano (consolidação, Cron) não chega ao grafo por nenhuma escrita do usuário: quando o
  // cérebro traz um id que o grafo desconhece, pede a mesma atualização por API que o agente usa, sem tocar na árvore.
  useEffect(() => {
    // Compara com a árvore completa, não só com os nós do grafo: um neurônio que o filtro do grafo oculta (sem raízes, por exemplo)
    // já é conhecido, e pedir de novo a mesma atualização a cada dez segundos não traria nada.
    const conhecidas = indexarNotas(itens);
    if (cerebroWiki?.dados?.neuronios?.some((n) => !neuronios.has(n.id) && !conhecidas.has(n.id))) window.dispatchEvent(new Event("bimo:nota-alterada-pelo-agente"));
  }, [cerebroWiki?.dados, neuronios, itens]);
  const estadosWiki = useMemo(() => new Map(cerebroWiki?.dados?.neuronios?.map((n) => [n.id, n.estado]) ?? []), [cerebroWiki?.dados]);
  // "Nascidos esta semana" e "Precisam de você" recortam o grafo aos neurônios do filtro; "Tudo" e "Só neurônios" não recortam por id.
  const [agoraDoFiltro] = useState(() => Date.now());
  const neuroniosVisiveis = useMemo(() => neuroniosDoFiltro(cerebroWiki?.dados?.neuronios ?? [], filtroDoCerebro, agoraDoFiltro), [cerebroWiki?.dados, filtroDoCerebro, agoraDoFiltro]);
  // Nota selecionada no grafo da aba Gráfico — a que ganha o cartão de foco. É
  // separada da aberta: selecionar é "olhar", abrir é "ler".
  const [notaFocada, setNotaFocada] = useState<IdDeNota | null>(null);
  // Com o cérebro filtrado, uma seleção que o filtro esconde deixa de valer: nada de foco (nem cartão) num nó que não está desenhado.
  const selecaoVisivel = notaFocada && (painelWiki !== "cerebro" || filtroDoCerebro === "tudo" || (neuronios.has(notaFocada) && (neuroniosVisiveis?.has(notaFocada) ?? true))) ? notaFocada : null;
  // Cada escolha na barra lateral pede à câmera que vá até a nota — inclusive de
  // novo, se ela já era a selecionada (ver `focoPedido` no GrafoDeFundo).
  const [pedidoDeFoco, setPedidoDeFoco] = useState(0);
  const [rascunho, setRascunho] = useState("");
  const [paletaAberta, setPaletaAberta] = useState(false);

  // No celular não cabem os dois painéis lado a lado, então a lista vira um menu.
  const [menuAberto, setMenuAberto] = useState(false);

  // Incrementar isto é o sinal para o grafo dar um pulso de movimento — acontece a cada
  // resposta do agente.
  const [pulsoDoGrafo, setPulsoDoGrafo] = useState(0);
  // Por onde o agente passou na pergunta atual — o grafo acende essas notas. Uma pergunta
  // nova começa um rastro novo; o anterior fica marcado até lá. O relógio é o do
  // `requestAnimationFrame` (`performance.now`), o mesmo que o grafo usa para desenhar.
  const [rastro, definirRastro] = useState<Rastro | null>(null);
  const iniciarRastroDoAgente = useCallback(() => definirRastro(iniciarRastro(performance.now())), []);
  // A hora é lida no evento, fora do updater: o React pode rodar o updater mais tarde (ou duas
  // vezes no StrictMode), e o rastro tem que guardar quando o passo chegou, não quando renderizou.
  const registrarPassoDoAgente = useCallback((passo: PassoDoAgente) => {
    const agora = performance.now();
    definirRastro((atual) => (atual ? registrarPasso(atual, passo, agora) : atual));
  }, []);
  const encerrarRastroDoAgente = useCallback(() => {
    const agora = performance.now();
    definirRastro((atual) => (atual ? encerrarRastro(atual, agora) : atual));
  }, []);
  // Uma fonte clicada no chat: a nota acende no cérebro por um instante (mesmo relógio do rastro).
  const [realce, definirRealce] = useState<RealceNoGrafo | null>(null);
  const mostrarNoCerebro = useCallback((id: IdDeNota) => definirRealce({ id, em: performance.now() }), []);
  const marcasNaLista = useMemo(() => marcasDoRastro(rastro), [rastro]);

  const controleDoGrafo = useRef<ControleDoGrafo>(null);

  const emNotas = modo === "notas";
  const graus = useMemo(() => calcularGraus(grafo.arestas), [grafo.arestas]);
  const [notasLocais, definirNotasLocais] = useState<NotasLocais>(new Map());
  const [idsComConfirmacaoAoSair, definirIdsComConfirmacaoAoSair] = useState<ReadonlySet<string>>(new Set());
  const [focoPedido, definirFocoPedido] = useState<FocoPedido | null>(null);
  const notasPorId = useMemo(() => mesclarNotasLocais(indexarNotas(itens), notasLocais), [itens, notasLocais]);
  const arvore = useMemo(() => construirArvore([...notasPorId.values()]), [notasPorId]);
  const idsExistentes = useMemo(() => new Set(indexarNotas(itens).keys()), [itens]);
  const idsLocais = useMemo(() => new Set(notasLocais.keys()), [notasLocais]);
  const { estado, despachar } = useEspacoDeTrabalho(idsExistentes, idsLocais);

  const aba = abaAtiva(estado);
  const noGrafico = estado.ativa === ABA_DO_GRAFICO;
  const idDaNotaAberta = aba?.tipo === "nota" ? idAtual(aba) : null;
  const dadosDaNotaFocada = notaFocada ? notasPorId.get(notaFocada) : undefined;
  // No cérebro, escolher um neurônio abre o cartão dele por cima do grafo; as origens são as pontas das sinapses.
  const neuronioSelecionado = useMemo(() => {
    if (!selecaoVisivel || !neuronios.has(selecaoVisivel)) return null;
    const origens = grafo.arestas
      .flatMap((a) => a.tipo !== "sinapse" ? [] : a.de === selecaoVisivel ? [a.para] : a.para === selecaoVisivel ? [a.de] : [])
      .flatMap((origem) => notasPorId.get(origem)?.titulo ?? []);
    const nota = notasPorId.get(selecaoVisivel);
    return { id: selecaoVisivel, titulo: nota?.titulo ?? "Neurônio", pasta: nota ? grupoDaPasta(nota.pasta) : null, origens };
  }, [selecaoVisivel, neuronios, grafo.arestas, notasPorId]);
  const tituloDaNota = useCallback((id: IdDeNota) => notasPorId.get(id)?.titulo, [notasPorId]);
  const resumoDoUltimoRastro = useMemo(() => resumoDoRastro(rastro, tituloDaNota), [rastro, tituloDaNota]);

  function mudarModo(novo: Modo) {
    definirPainelWiki(null); abrirNeuronioId(null);
    setModo(novo);
    setMenuAberto(false);
  }

  /**
   * Abrir uma nota leva ao modo Notas (a nota vive lá) e fecha o que estiver aberto por cima.
   * Estável (só usa setters e `despachar`): quem a recebe — o texto da nota, com todas as
   * ligações — não pode remontar a cada render deste componente.
   */
  const abrirNota = useCallback(
    (id: IdDeNota, opcoes: { novaAba: boolean } = { novaAba: false }) => {
      definirPainelWiki(null); abrirNeuronioId(null);
      despachar({ tipo: "abrir-nota", id, novaAba: opcoes.novaAba });
      definirFocoPedido({ id, alvo: "nota" });
      setModo("notas");
      setMenuAberto(false);
      setPaletaAberta(false);
    },
    [despachar],
  );
  const abrirNeuronio = useCallback((id: string) => {
    abrirNeuronioId(id); definirPainelWiki(null); setModo("notas"); setMenuAberto(false); setPaletaAberta(false);
    despachar({ tipo: "ativar-aba", chave: ABA_DO_GRAFICO });
  }, [despachar]);
  function mostrarWiki(tela: "cerebro" | "diario") {
    definirPainelWiki(tela); abrirNeuronioId(null); setModo("notas"); setMenuAberto(false); setPaletaAberta(false);
    despachar({ tipo: "ativar-aba", chave: ABA_DO_GRAFICO });
  }

  /** Protege escritas recentes até uma listagem posterior confirmá-las. */
  const registrarNota = useCallback((resumo: NotaParaArvore) => {
    const criadoEm = Date.now();
    const metadados = { id: resumo.id, titulo: resumo.titulo, pasta: resumo.pasta };
    definirNotasLocais((locais) => new Map(locais).set(resumo.id, { resumo: metadados, criadoEm }));
  }, []);
  const criacao = useCriacaoDeNota({
    capacidades, notas: [...notasPorId.values()], registrar: registrarNota,
    abrir: (id, opcoes) => {
      if (opcoes.criada && opcoes.alvo === "titulo") definirIdsComConfirmacaoAoSair((ids) => new Set(ids).add(id));
      despachar({ tipo: "abrir-nota", id, novaAba: opcoes.novaAba, modo: opcoes.criada ? "edicao" : "leitura" });
      definirFocoPedido({ id, alvo: opcoes.criada ? opcoes.alvo : "nota" });
      setModo("notas"); setMenuAberto(false); setPaletaAberta(false);
    },
  });
  const pastaAtual = idDaNotaAberta ? notasPorId.get(idDaNotaAberta)?.pasta ?? null : null;
  const criarNova = () => criacao.criar({ pasta: pastaAtual });
  const criarNovaAtual = useRef(criarNova);
  useEffect(() => { criarNovaAtual.current = criarNova; });
  useEffect(() => {
    if (!focoPedido) return;
    const timer = setTimeout(() => definirFocoPedido(null), 10000);
    return () => clearTimeout(timer);
  }, [focoPedido]);
  useEffect(() => {
    if (focoPedido && focoPedido.id !== idDaNotaAberta) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      definirFocoPedido(null);
    }
  }, [focoPedido, idDaNotaAberta, estado.ativa]);
  const abertasAntes = useRef(new Set<string>());
  useEffect(() => {
    const abertas = new Set(estado.abas.flatMap((aba) => aba.tipo === "nota" ? aba.historico.pilha : []));
    for (const id of abertasAntes.current) if (!abertas.has(id)) esquecerSemente(id);
    abertasAntes.current = abertas;
  }, [estado.abas]);

  /** No Gráfico a barra lateral seleciona o nó; nas demais abas abre a nota. */
  function escolherNoMenu(id: IdDeNota) {
    if (emNotas && noGrafico) {
      // Como no clique do grafo: uma nota pessoal escolhida com o cérebro aberto volta ao grafo normal.
      if (painelWiki === "cerebro" && !neuronios.has(id)) definirPainelWiki(null);
      setNotaFocada(id);
      setPedidoDeFoco((n) => n + 1);
      setMenuAberto(false);
      return;
    }
    abrirNota(id);
  }

  function perguntarAoBimo(id: IdDeNota | null) {
    // O que a pessoa já tinha digitado no chat é dela: a pergunta vai depois, nunca por cima.
    if (id) {
      const pergunta = `O que eu anotei em "${notasPorId.get(id)?.titulo ?? "esta nota"}"?`;
      setRascunho((atual) => (atual.trim() === "" ? pergunta : `${atual}\n${pergunta}`));
    }
    mudarModo("bimo");
  }

  // Atalhos que valem em qualquer lugar da página (inclusive com o foco num campo de texto).
  // Os escritos como funções novas a cada render leem sempre o estado de agora.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (combinaAtalho(evento, "mod+o")) {
        evento.preventDefault();
        setPaletaAberta(true);
        return;
      }

      // A paleta é um diálogo modal: enquanto está aberta, o resto da página não reage a atalhos.
      if (paletaAberta) return;

      if (combinaAtalho(evento, "alt+n")) {
        const alvo = evento.target;
        if (/Mac|iPhone|iPad/.test(navigator.platform) && alvo instanceof Element && alvo.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
        evento.preventDefault(); if (!evento.repeat) void criarNovaAtual.current();
      } else if (combinaAtalho(evento, "mod+g")) {
        definirPainelWiki(null); abrirNeuronioId(null);
        evento.preventDefault();
        despachar({ tipo: "ativar-aba", chave: ABA_DO_GRAFICO });
        setModo("notas");
        // No celular o menu de notas cobre o conteúdo: sem fechá-lo o destino ficaria escondido.
        setMenuAberto(false);
      } else if (combinaAtalho(evento, "mod+j")) {
        definirPainelWiki(null); abrirNeuronioId(null);
        evento.preventDefault();
        setModo("bimo");
        setMenuAberto(false);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [paletaAberta, despachar]);

  /**
   * Sair de verdade: a rota apaga o cookie e recarregamos a página inteira.
   * `window.location` em vez do router do Next porque a home é server
   * component — uma navegação client-side manteria a árvore atual na tela.
   */
  async function sair() {
    await fetch("/api/logout", { method: "POST" });
    window.location.replace("/login");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Três colunas, a do meio auto: o seletor fica no centro de verdade, não "no que sobrar". */}
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-borda bg-painel px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuAberto((estava) => !estava)}
            aria-label="Mostrar ou esconder as notas"
            aria-expanded={menuAberto}
            className="flex h-10 w-10 items-center justify-center rounded-full text-suave transition-[color,background-color,transform] hover:bg-painel-alt hover:text-texto motion-safe:active:scale-[0.96] md:hidden"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4.5">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          {/* A marca, não o título da página: o `h1` é o da nota aberta (ou o da tela inicial). */}
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <MarcaBimo tamanho={24} />
            <span className="sr-only md:not-sr-only">Bimo</span>
          </p>
        </div>

        <SeletorPill
          rotulo="Modo de visualização"
          opcoes={OPCOES_DE_MODO}
          valor={modo}
          onChange={mudarModo}
        />

        <div className="flex items-center gap-2 justify-self-end">
          <button aria-label="Abrir cérebro" className="hidden min-h-10 rounded-full border border-destaque-suave-borda bg-destaque-suave px-3 text-meta text-destaque-texto md:block" onClick={() => mostrarWiki("cerebro")}>◉ {neuronios.size} neurônios</button>
          <AlternadorDeTema />
          <button
            type="button"
            onClick={sair}
            aria-label="Sair"
            className="flex h-10 min-w-10 items-center justify-center rounded-full border border-borda bg-painel px-2.5 text-sm font-semibold transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96] md:px-4"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 md:hidden">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
              <path d="M10 16l-4-4 4-4" />
              <path d="M6 12h10" />
            </svg>
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>
      </header>

      <AtualizadorDasNotas aoAtualizar={(dados, iniciadoEm) => {
        definirNotasLocais((locais) => podarNotasLocais(locais, indexarNotas(dados.itens), iniciadoEm));
        definirAtualizacao({ origem: itensIniciais, dados });
      }} />
      <p role="status" className="sr-only"><span key={criacao.idAnuncio}>{criacao.anuncio}</span></p>
      <p role="alert" className={criacao.erro ? "border-b border-borda bg-painel px-4 py-2 text-texto" : "sr-only"}><span key={criacao.idAnuncio}>{criacao.erro}</span></p>
      {(aviso || grafo.aviso) && (
        <p className="shrink-0 border-b border-destaque-suave-borda bg-destaque-suave px-4 py-1.5 text-center text-xs text-destaque-texto">
          {aviso ?? grafo.aviso}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          className={`${menuAberto ? "block" : "hidden"} w-full shrink-0 md:block md:w-64 lg:w-72`}
        >
          <BarraLateral
            itens={arvore}
            notaSelecionada={emNotas && noGrafico ? notaFocada : idDaNotaAberta}
            onSelecionarNota={(nota) => escolherNoMenu(nota.id)}
            marcas={marcasNaLista}
          />
        </div>

        {/* min-w-0 impede que uma mensagem longa estique este painel e quebre o layout. */}
        <main className={`${menuAberto ? "hidden" : "flex"} min-w-0 flex-1 flex-col md:flex`}>
          <nav aria-label="Conhecimento do Bimo" className="flex shrink-0 gap-2 border-b border-borda bg-painel px-3 py-1.5">
            <button type="button" aria-pressed={painelWiki === "cerebro"} className={chip(painelWiki === "cerebro")} onClick={() => painelWiki === "cerebro" ? definirPainelWiki(null) : mostrarWiki("cerebro")}><span aria-hidden>◈</span>Cérebro</button>
            <button type="button" aria-pressed={painelWiki === "diario"} className={chip(painelWiki === "diario")} onClick={() => painelWiki === "diario" ? definirPainelWiki(null) : mostrarWiki("diario")}>Diário</button>
          </nav>
          <EspacoDeTrabalho
            ativo={emNotas}
            estado={estado}
            despachar={despachar}
            notas={notasPorId}
            conexoesPorNota={graus}
            totais={{ notas: notasPorId.size, conexoes: grafo.arestas.length }}
            aoAbrirNota={abrirNota}
            aoCriarNota={(titulo, pasta, opcoes) => criacao.criar({ titulo, pasta: pasta === undefined ? pastaAtual : pasta, novaAba: opcoes?.novaAba })}
            aoNovaNota={criarNova}
            criarDisponivel={capacidades.escrita}
            focoPedido={focoPedido}
            aoConsumirFoco={() => definirFocoPedido(null)}
            idsComConfirmacaoAoSair={idsComConfirmacaoAoSair}
            aoSairDoTitulo={(id) => definirIdsComConfirmacaoAoSair((ids) => {
              if (!ids.has(id)) return ids;
              const restantes = new Set(ids); restantes.delete(id); return restantes;
            })}
            aoRenomear={registrarNota}
            aoPerguntarAoBimo={perguntarAoBimo}
            aoIrParaNota={() => setPaletaAberta(true)}
          >
            <GrafoDeFundo
              somenteNeuronios={painelWiki === "cerebro" && filtroDoCerebro !== "tudo"}
              neuroniosVisiveis={painelWiki === "cerebro" ? neuroniosVisiveis : null}
              chaveDoFiltro={painelWiki === "cerebro" ? filtroDoCerebro : "tudo"}
              estadosWiki={estadosWiki}
              nos={grafo.nos}
              arestas={grafo.arestas}
              configuracao={grafo.configuracao}
              notaAberta={idDaNotaAberta}
              pulso={pulsoDoGrafo}
              rastro={rastro}
              realce={realce}
              reservaInferior={RESERVA_DA_CONVERSA}
              onAbrirNota={(id) => neuronios.has(id) ? abrirNeuronio(id) : abrirNota(id)}
              interativo={emNotas}
              pausado={emNotas && (!noGrafico || Boolean(neuronioAberto) || painelWiki === "diario")}
              selecionado={selecaoVisivel}
              onSelecionar={(id) => {
                setNotaFocada(id);
                // Um neurônio ganha o cartão do cérebro; uma nota pessoal volta ao grafo normal, com o cartão de foco dela.
                if (painelWiki === "cerebro" && id && !neuronios.has(id)) definirPainelWiki(null);
              }}
              focoPedido={pedidoDeFoco}
              controleRef={controleDoGrafo}
            />

            {/* O chat fica montado mesmo no modo Notas (só escondido): a conversa vive no estado dele. */}
            <div className="relative h-full" hidden={emNotas}>
              <Chat
                ativo={!emNotas}
                aoAbrirNota={(id, resumo) => { if (resumo && !notasPorId.has(id)) registrarNota({ id, ...resumo }); if (neuronios.has(id)) abrirNeuronio(id); else abrirNota(id); }}
                aoNotaDoAgente={registrarNota}
                rascunho={rascunho}
                onRascunhoChange={setRascunho}
                onRespostaAgente={() => setPulsoDoGrafo((n) => n + 1)}
                aoIniciarResposta={iniciarRastroDoAgente}
                aoPassoDoAgente={registrarPassoDoAgente}
                aoEncerrarResposta={encerrarRastroDoAgente}
                aoMostrarNoCerebro={mostrarNoCerebro}
                tituloDaNota={tituloDaNota}
              />
            </div>

            {emNotas && noGrafico && !painelWiki && !neuronioAberto && (
              // O contêiner não recebe toque (`pointer-events-none`): só a barra e o cartão
              // recebem — o resto é grafo, que precisa de todo o arrasto.
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
                <BarraDoGrafo
                  nos={grafo.nos.length}
                  conexoes={grafo.arestas.length}
                  onAproximar={() => controleDoGrafo.current?.aproximar()}
                  onAfastar={() => controleDoGrafo.current?.afastar()}
                  onEnquadrar={() => controleDoGrafo.current?.enquadrar()}
                />

                {notaFocada && dadosDaNotaFocada && (
                  <div className="flex justify-center p-3 md:justify-start md:p-4">
                    <CartaoDeFoco
                      titulo={dadosDaNotaFocada.titulo}
                      pasta={grupoDaPasta(dadosDaNotaFocada.pasta)}
                      conexoes={graus.get(notaFocada) ?? 0}
                      onAbrir={() => neuronios.has(notaFocada) ? abrirNeuronio(notaFocada) : abrirNota(notaFocada)}
                      onVizinhos={() => controleDoGrafo.current?.enquadrarVizinhos()}
                      onPerguntar={() => perguntarAoBimo(notaFocada)}
                      onFechar={() => setNotaFocada(null)}
                    />
                  </div>
                )}

                {/* O que o Bimo fez na última pergunta, para achar no globo. Cede o lugar ao cartão de foco. */}
                {!(notaFocada && dadosDaNotaFocada) && resumoDoUltimoRastro && (
                  <div className="flex p-3 md:p-4">
                    <p className="flex min-h-9 max-w-full items-center gap-2 rounded-full border border-destaque-suave-borda bg-destaque-suave px-3.5 text-meta text-texto motion-safe:animate-entrada">
                      <MarcaBimo tamanho={16} />
                      <span className="truncate">{resumoDoUltimoRastro}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
            {painelWiki && (
              <PainelDaWiki
                tela={painelWiki}
                filtro={filtroDoCerebro}
                aoFiltrar={filtrarCerebro}
                selecionado={neuronioSelecionado}
                aoFechar={() => definirPainelWiki(null)}
                aoAbrirNeuronio={abrirNeuronio}
                aoVerCerebro={() => mostrarWiki("cerebro")}
                // Com um filtro as origens não estão desenhadas: enquadrá-las mostraria só o vazio.
                aoVerOrigens={filtroDoCerebro === "tudo" ? () => controleDoGrafo.current?.enquadrarVizinhos() : undefined}
                aoPerguntar={perguntarAoBimo}
                aoDesselecionar={() => setNotaFocada(null)}
                aoAbrirNota={(id) => { definirPainelWiki(null); abrirNota(id); }}
              />
            )}
            {neuronioAberto && (
              <section ref={focoNeuronio} tabIndex={-1} aria-label="Neurônio aberto" className="absolute inset-0 z-30 overflow-y-auto bg-painel outline-none">
                <NeuronioAberto
                  key={neuronioAberto}
                  id={neuronioAberto}
                  tituloDaNota={tituloDaNota}
                  aoAbrirNota={(id) => neuronios.has(id) ? abrirNeuronio(id) : abrirNota(id)}
                  aoEditar={(id) => { abrirNota(id); despachar({ tipo: "abrir-nota", id, novaAba: false, modo: "edicao" }); }}
                  aoPerguntar={perguntarAoBimo}
                  aoVoltar={() => mostrarWiki("cerebro")}
                  aoFechar={() => abrirNeuronioId(null)}
                />
              </section>
            )}
          </EspacoDeTrabalho>
        </main>
      </div>

      <PaletaIrParaNota
        aberta={paletaAberta}
        notas={[...notasPorId.values()]}
        recentes={estado.recentes}
        podeCriar={capacidades.escrita}
        pastaDaCriacao={idDaNotaAberta ? (notasPorId.get(idDaNotaAberta)?.pasta ?? null) : null}
        aoFechar={() => setPaletaAberta(false)}
        aoAbrir={abrirNota}
        aoCriar={(titulo, pasta) => criacao.criar({ titulo, pasta })}
      />
    </div>
  );
}
