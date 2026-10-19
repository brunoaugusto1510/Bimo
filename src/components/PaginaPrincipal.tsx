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
import type { IdDeNota, ItemDeNotas } from "@/lib/types";

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

export default function PaginaPrincipal({ itens: itensIniciais, grafo: grafoInicial, aviso: avisoInicial, capacidades: capacidadesIniciais = SOMENTE_LEITURA }: Props) {
  const [atualizacao, definirAtualizacao] = useState<{ origem: Props["itens"]; dados: import("@/lib/servico-de-notas").DadosDaPagina } | null>(null);
  const { itens, grafo, aviso, capacidades } = atualizacao?.origem === itensIniciais ? atualizacao.dados : { itens: itensIniciais, grafo: grafoInicial, aviso: avisoInicial, capacidades: capacidadesIniciais };
  const [modo, setModo] = useState<Modo>("bimo");
  // Nota selecionada no grafo da aba Gráfico — a que ganha o cartão de foco. É
  // separada da aberta: selecionar é "olhar", abrir é "ler".
  const [notaFocada, setNotaFocada] = useState<IdDeNota | null>(null);
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

  const controleDoGrafo = useRef<ControleDoGrafo>(null);

  const emNotas = modo === "notas";
  const graus = useMemo(() => calcularGraus(grafo.arestas), [grafo.arestas]);
  const [notasLocais, definirNotasLocais] = useState<NotasLocais>(new Map());
  const [idsComTituloEditavel, definirIdsComTituloEditavel] = useState<ReadonlySet<string>>(new Set());
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

  function mudarModo(novo: Modo) {
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
      despachar({ tipo: "abrir-nota", id, novaAba: opcoes.novaAba });
      definirFocoPedido({ id, alvo: "nota" });
      setModo("notas");
      setMenuAberto(false);
      setPaletaAberta(false);
    },
    [despachar],
  );

  /** Protege escritas recentes até uma listagem posterior confirmá-las. */
  const registrarNota = useCallback((resumo: NotaParaArvore) => {
    const criadoEm = Date.now();
    const metadados = { id: resumo.id, titulo: resumo.titulo, pasta: resumo.pasta };
    definirNotasLocais((locais) => new Map(locais).set(resumo.id, { resumo: metadados, criadoEm }));
  }, []);
  const criacao = useCriacaoDeNota({
    capacidades, notas: [...notasPorId.values()], registrar: registrarNota,
    abrir: (id, opcoes) => {
      if (opcoes.criada && opcoes.alvo === "titulo") definirIdsComTituloEditavel((ids) => new Set(ids).add(id));
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
        evento.preventDefault();
        despachar({ tipo: "ativar-aba", chave: ABA_DO_GRAFICO });
        setModo("notas");
        // No celular o menu de notas cobre o conteúdo: sem fechá-lo o destino ficaria escondido.
        setMenuAberto(false);
      } else if (combinaAtalho(evento, "mod+j")) {
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
            className="flex h-10 w-10 items-center justify-center rounded-full text-suave transition-[color,background-color,transform] hover:bg-painel-alt hover:text-texto motion-safe:active:scale-[0.96] md:hidden"
          >
            ☰
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
          <AlternadorDeTema />
          <button
            type="button"
            onClick={sair}
            aria-label="Sair"
            className="flex h-10 min-w-10 items-center justify-center rounded-full border border-borda bg-painel px-2.5 text-sm font-semibold transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96] md:px-4"
          >
            <span aria-hidden className="md:hidden">
              ⏻
            </span>
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
          />
        </div>

        {/* min-w-0 impede que uma mensagem longa estique este painel e quebre o layout. */}
        <main className={`${menuAberto ? "hidden" : "flex"} min-w-0 flex-1 flex-col md:flex`}>
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
            idsComTituloEditavel={idsComTituloEditavel}
            aoRenomear={registrarNota}
            aoPerguntarAoBimo={perguntarAoBimo}
            aoIrParaNota={() => setPaletaAberta(true)}
          >
            <GrafoDeFundo
              nos={grafo.nos}
              arestas={grafo.arestas}
              configuracao={grafo.configuracao}
              notaAberta={idDaNotaAberta}
              pulso={pulsoDoGrafo}
              onAbrirNota={abrirNota}
              interativo={emNotas}
              pausado={emNotas && !noGrafico}
              selecionado={notaFocada}
              onSelecionar={setNotaFocada}
              focoPedido={pedidoDeFoco}
              controleRef={controleDoGrafo}
            />

            {/* O chat fica montado mesmo no modo Notas (só escondido): a conversa vive no estado dele. */}
            <div className="relative h-full" hidden={emNotas}>
              <Chat
                ativo={!emNotas}
                aoAbrirNota={(id, resumo) => { if (resumo && !notasPorId.has(id)) registrarNota({ id, ...resumo }); abrirNota(id); }}
                aoNotaDoAgente={registrarNota}
                rascunho={rascunho}
                onRascunhoChange={setRascunho}
                onRespostaAgente={() => setPulsoDoGrafo((n) => n + 1)}
              />
            </div>

            {emNotas && noGrafico && (
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
                      onAbrir={() => abrirNota(notaFocada)}
                      onVizinhos={() => controleDoGrafo.current?.enquadrarVizinhos()}
                      onPerguntar={() => perguntarAoBimo(notaFocada)}
                      onFechar={() => setNotaFocada(null)}
                    />
                  </div>
                )}
              </div>
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
