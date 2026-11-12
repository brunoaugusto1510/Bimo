"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dividirCaminho } from "@/lib/caminho-da-nota";
import type { NotaParaArvore } from "@/lib/arvore-de-notas";
import type { ClienteDeConversas } from "@/lib/conversas/cliente";
import type { IdDeConversa } from "@/lib/conversas/tipos";
import { ErroDaRespostaDoChat, lerRespostaDoChat, passoDoRastro, type LinhaDePasso } from "@/lib/fluxo-do-chat";
import ContextoDoChat from "./ContextoDoChat";
import { janelaParaOAgente } from "@/lib/janela-do-historico";
import type { PassoDoAgente } from "@/lib/rastro-do-agente";
import HistoricoDeConversas from "./HistoricoDeConversas";
import Mensagem, { TurnoDoBimo, type AbrirNotaDoChat, type MostrarNoCerebro } from "./Mensagem";
import type { AnexoDeNota, FonteDaResposta, IdDeNota, Mensagem as TipoMensagem, UsoDeFerramenta } from "@/lib/types";

type Props = {
  aoMudarOcupacao?: (ocupado: boolean) => void;
  avisoDeContexto?: string;
  notasDeContexto?: string[];
  aoMudarContexto?: (ids: string[]) => void;
  notasDisponiveis?: NotaParaArvore[];
  notasAbertas?: string[];
  pedidoDeFoco?: number;
  /** O texto do campo vive no componente pai, porque clicar numa nota da barra lateral também escreve nele. */
  rascunho: string;
  onRascunhoChange: (texto: string) => void;
  /** Chamado toda vez que uma resposta do agente chega — o grafo de fundo usa isso para "reagir". */
  onRespostaAgente?: () => void;
  /**
   * Falso quando o chat está montado mas escondido (aba Notas). Escondido, o
   * navegador não faz layout dele: rolar não faz nada e o `scrollHeight` do
   * campo vem 0 — então rolagem e altura esperam o chat voltar a aparecer.
   */
  ativo?: boolean;
  aoAbrirNota?: AbrirNotaDoChat;
  aoNotaDoAgente?: (nota: NotaParaArvore) => void;
  /** O agente começou a trabalhar numa pergunta — o grafo começa um rastro novo. */
  aoIniciarResposta?: () => void;
  /** Cada nota que o agente busca, lê ou escreve, na hora em que acontece. */
  aoPassoDoAgente?: (passo: PassoDoAgente) => void;
  /** A resposta chegou ou falhou: o rastro para de crescer e as notas usadas ficam marcadas. */
  aoEncerrarResposta?: () => void;
  /** Clique numa das "Fontes" de uma resposta: a nota acende no cérebro. */
  aoMostrarNoCerebro?: MostrarNoCerebro;
  /** O título atual de uma nota, para as fontes; sem ele, vale o caminho que o agente usou. */
  tituloDaNota?: (id: IdDeNota) => string | undefined;
  /** Onde o histórico fica guardado. Sem ele a conversa vive só nesta tela, sem botões de histórico e de novo chat. */
  conversas?: ClienteDeConversas;
  /**
   * Onde os botões de histórico e novo chat aparecem (a barra "Cérebro / Diário" da página). `null`
   * enquanto esse lugar ainda não existe; sem a prop eles ficam no alto do chat. Só aparecem com o chat à vista.
   */
  lugarDosBotoes?: HTMLElement | null;
};

/** O texto do turno que guarda uma escrita quando a resposta cai no meio. */
const RESPOSTA_INTERROMPIDA = "A resposta foi interrompida, mas o que está abaixo já foi gravado.";

/** Até aqui o campo cresce com o texto; depois disso ele rola por dentro. */
const ALTURA_MAXIMA_DO_CAMPO = 160;

/** Uma de cada coisa que o Bimo faz: responder, criar uma nota, editar uma. Escolher só preenche o campo. */
const SUGESTOES = [
  "O que eu sei sobre normalização de banco de dados?",
  "Cria uma nota resumindo minhas anotações de redes",
  "Acrescenta um exemplo na minha nota sobre React",
];

export default function Chat({ rascunho, onRascunhoChange, onRespostaAgente, ativo = true, aoAbrirNota, aoNotaDoAgente, aoIniciarResposta, aoPassoDoAgente, aoEncerrarResposta, aoMostrarNoCerebro, tituloDaNota, conversas, lugarDosBotoes, notasDeContexto, aoMudarContexto, notasDisponiveis, notasAbertas, pedidoDeFoco, aoMudarOcupacao, avisoDeContexto }: Props) {
  const [contextoLocal, definirContextoLocal] = useState<string[]>([]);
  const idsDeContexto = notasDeContexto ?? contextoLocal;
  const mudarContexto = aoMudarContexto ?? definirContextoLocal;
  const [indisponiveis, definirIndisponiveis] = useState<string[]>([]);
  const [mensagens, setMensagens] = useState<TipoMensagem[]>([]);
  const [pensando, setPensando] = useState(false);
  // Os passos do agente na pergunta atual, conforme chegam — viram as pílulas acima da resposta.
  const [passosAoVivo, setPassosAoVivo] = useState<LinhaDePasso[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  // O id nasce aqui: a conversa só existe no servidor a partir da primeira mensagem guardada.
  const [idDaConversa, setIdDaConversa] = useState<IdDeConversa>(() => crypto.randomUUID());
  const [abrindo, setAbrindo] = useState(false);
  const [avisoDoHistorico, setAvisoDoHistorico] = useState<string | null>(null);

  const fimDaLista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  // Uma gravação de cada vez, na ordem: o histórico guarda as mensagens na ordem em que chegam.
  const filaDeGravacao = useRef<Promise<void>>(Promise.resolve());
  const ultimaAbertura = useRef(0);
  const contextoGravado = useRef("[]");
  const falhasDeGravacao = useRef(new Set<string>());
  const mensagensPendentes = useRef(new Map<IdDeConversa, TipoMensagem[]>());
  const rascunhoAtual = useRef(rascunho);
  useEffect(() => { rascunhoAtual.current = rascunho; }, [rascunho]);
  useEffect(() => { aoMudarOcupacao?.(pensando || abrindo); }, [pensando, abrindo, aoMudarOcupacao]);

  useEffect(() => {
    const assinatura = JSON.stringify(idsDeContexto);
    if (assinatura === contextoGravado.current) return;
    contextoGravado.current = assinatura;
    if (!conversas) return;
    const chave = `${idDaConversa}:contexto`;
    filaDeGravacao.current = filaDeGravacao.current
      .then(() => conversas.atualizarContexto(idDaConversa, idsDeContexto))
      .then(() => {
        falhasDeGravacao.current.delete(chave);
        if (!falhasDeGravacao.current.size) setAvisoDoHistorico(null);
      }, () => {
        falhasDeGravacao.current.add(chave);
        setAvisoDoHistorico("Não consegui guardar as notas de contexto. Elas continuam aqui. Use Tentar guardar novamente.");
      });
  }, [idsDeContexto, conversas, idDaConversa]);

  useEffect(() => {
    if (ativo && pedidoDeFoco) campo.current?.focus();
  }, [ativo, pedidoDeFoco]);

  useEffect(() => {
    if (!ativo || !idsDeContexto.length) return;
    const controle = new AbortController();
    const verificar = async () => {
      const resultados = await Promise.all(idsDeContexto.map(async (id) => {
        try {
          const resposta = await fetch(`/api/notas/${encodeURIComponent(id)}`, { signal: controle.signal });
          return resposta.status === 404 || resposta.status === 410 ? id : null;
        } catch { return null; }
      }));
      if (!controle.signal.aborted) definirIndisponiveis(resultados.filter((id) => id !== null));
    };
    void verificar();
    window.addEventListener("bimo:lixeira-alterada", verificar);
    return () => { controle.abort(); window.removeEventListener("bimo:lixeira-alterada", verificar); };
  }, [ativo, idsDeContexto, notasDisponiveis]);

  function tentarGuardarNovamente() {
    if (!conversas) return;
    const id = idDaConversa;
    const ids = [...idsDeContexto];
    filaDeGravacao.current = filaDeGravacao.current.then(async () => {
      await conversas.atualizarContexto(id, ids);
      await gravarMensagensPendentes(id);
    }).then(() => {
      for (const chave of falhasDeGravacao.current) if (chave.startsWith(`${id}:`)) falhasDeGravacao.current.delete(chave);
      setAvisoDoHistorico(null);
    }, () => setAvisoDoHistorico("Não consegui guardar esta conversa. Tente novamente."));
  }

  /** Quem lista o histórico espera as gravações em andamento, senão a conversa de agora não aparece. */
  function aguardarGravacoes(): Promise<void> {
    return filaDeGravacao.current;
  }

  /** Uma pergunta que falhou precisa entrar antes da resposta, inclusive ao repetir uma gravação. */
  async function gravarMensagensPendentes(id: IdDeConversa) {
    if (!conversas) return;
    for (;;) {
      const lote = (mensagensPendentes.current.get(id) ?? []).slice(0, 10);
      if (!lote.length) break;
      await conversas.acrescentar(id, lote);
      const gravadas = new Set(lote.map((m) => m.id));
      mensagensPendentes.current.set(id, (mensagensPendentes.current.get(id) ?? []).filter((m) => !gravadas.has(m.id)));
    }
    mensagensPendentes.current.delete(id);
  }

  function guardar(id: IdDeConversa, novas: TipoMensagem[]) {
    if (!conversas) return;
    const chave = `${id}:mensagens`;
    const pendentes = mensagensPendentes.current.get(id) ?? [];
    mensagensPendentes.current.set(id, [...pendentes, ...novas.filter((m) => !pendentes.some((p) => p.id === m.id))]);
    filaDeGravacao.current = filaDeGravacao.current
      .then(() => gravarMensagensPendentes(id))
      .then(
        () => { falhasDeGravacao.current.delete(chave); if (!falhasDeGravacao.current.size) setAvisoDoHistorico(null); },
        () => { falhasDeGravacao.current.add(chave); setAvisoDoHistorico("Não consegui guardar esta conversa no histórico. Ela continua aqui, mas pode não aparecer depois."); },
      );
  }

  function novaConversa() {
    if (pensando) return;
    ultimaAbertura.current += 1;
    setAbrindo(false);
    setMensagens([]);
    setPassosAoVivo([]);
    setErro(null);
    setAvisoDoHistorico(null);
    setIdDaConversa(crypto.randomUUID());
    contextoGravado.current = "[]";
    mudarContexto([]);
    definirIndisponiveis([]);
    onRascunhoChange("");
    campo.current?.focus();
  }

  async function abrirConversa(id: IdDeConversa) {
    if (!conversas || pensando) return;
    const pedido = ++ultimaAbertura.current;
    setAbrindo(true);
    setErro(null);
    try {
      await filaDeGravacao.current;
      const aberta = await conversas.abrir(id);
      if (pedido !== ultimaAbertura.current) return;
      const idsGuardados = new Set(aberta.mensagens.map((m) => m.id));
      const pendentes = (mensagensPendentes.current.get(id) ?? []).filter((m) => !idsGuardados.has(m.id));
      setMensagens([...aberta.mensagens, ...pendentes]);
      setPassosAoVivo([]);
      setAvisoDoHistorico(pendentes.length ? "Há mensagens desta conversa que ainda não foram guardadas. Tente guardar novamente." : null);
      setIdDaConversa(aberta.conversa.id);
      contextoGravado.current = JSON.stringify(aberta.notasDeContexto ?? []);
      mudarContexto(aberta.notasDeContexto ?? []);
      definirIndisponiveis([]);
      onRascunhoChange("");
      campo.current?.focus();
    } catch (falha) {
      if (pedido === ultimaAbertura.current) setErro(falha instanceof Error ? falha.message : "Não consegui abrir a conversa.");
    } finally {
      if (pedido === ultimaAbertura.current) setAbrindo(false);
    }
  }

  // Rolar para o fim sempre que chegar mensagem nova, um passo ou o "pensando" — e
  // ao voltar de escondido, quando o que chegou nesse meio-tempo ficou fora da vista.
  useEffect(() => {
    if (!ativo) return;
    // `nearest`: rola só a lista do chat, nunca a página inteira.
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensagens, pensando, passosAoVivo, ativo]);

  // O textarea cresce junto com o texto, até um limite.
  useEffect(() => {
    const elemento = campo.current;
    if (!ativo || !elemento) return;
    elemento.style.height = "auto";
    // `scrollHeight` não conta a borda, mas o campo é `border-box`: sem somá-la ele
    // fica 2px menor que o texto e o navegador mostra uma barra de rolagem à toa.
    const bordas = elemento.offsetHeight - elemento.clientHeight;
    const altura = elemento.scrollHeight + bordas;
    elemento.style.height = `${Math.min(altura, ALTURA_MAXIMA_DO_CAMPO)}px`;
    // A barra só aparece quando o texto realmente passa do limite.
    elemento.style.overflowY = altura > ALTURA_MAXIMA_DO_CAMPO ? "auto" : "hidden";
  }, [rascunho, ativo]);

  async function enviar() {
    const texto = rascunho.trim();
    if (!texto || pensando || abrindo || idsDeContexto.some((id) => indisponiveis.includes(id))) return;
    // Uma conversa aberta do histórico no meio da resposta não pode receber o fim desta.
    const idDestaConversa = idDaConversa;

    const doUsuario: TipoMensagem = {
      id: crypto.randomUUID(),
      papel: "usuario",
      conteudo: texto,
    };

    // Guardamos o histórico completo (incluindo a mensagem que acabou de
    // entrar) para mandar pro agente — ele precisa da conversa toda, não só
    // da última pergunta.
    const historico = [...mensagens, doUsuario];

    setMensagens(historico);
    // Com anexos, aguarda o recibo do servidor antes de guardar os metadados.
    let perguntaGuardada = false;
    if (!idsDeContexto.length) { guardar(idDestaConversa, [doUsuario]); perguntaGuardada = true; }
    onRascunhoChange("");
    setPensando(true);
    setPassosAoVivo([]);
    setErro(null);
    aoIniciarResposta?.();

    // Os passos desta resposta e as notas lidas (as "Fontes"). Só o fluxo traz os ids delas.
    const recebidos: LinhaDePasso[] = [];
    const fontes = new Map<IdDeNota, FonteDaResposta>();
    const receberContexto = (anexos: AnexoDeNota[]) => {
      if (perguntaGuardada) return;
      if (anexos.length !== idsDeContexto.length || anexos.some((anexo) => !idsDeContexto.includes(anexo.id))) throw new Error("Não consegui confirmar as notas de contexto. Tente novamente.");
      doUsuario.anexos = anexos;
      setMensagens((atuais) => atuais.map((m) => m.id === doUsuario.id ? { ...m, anexos } : m));
      guardar(idDestaConversa, [doUsuario]);
      perguntaGuardada = true;
      for (const anexo of anexos) {
        fontes.set(anexo.id, { id: anexo.id, titulo: anexo.titulo });
        aoPassoDoAgente?.({ tipo: "leitura", id: anexo.id });
      }
    };

    try {
      const resposta = await fetch("/api/chat", {
        method: "POST",
        // NDJSON: cada ferramenta usada chega na hora, e o grafo mostra por onde o agente passa.
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({
          mensagens: janelaParaOAgente(historico),
          ...(idsDeContexto.length ? { notasDeContexto: idsDeContexto } : {}),
        }),
      });

      // Escrita avisada já no passo: a nota entra na lista (e nasce no grafo) mesmo se o modelo
      // falhar depois de gravar. Cada escrita do fluxo avisa (a mesma nota pode ser editada duas
      // vezes); a resposta final só avisa as notas que o fluxo não trouxe.
      const avisadasNoFluxo = new Set<string>();
      const avisarEscrita = (ferramenta: Pick<UsoDeFerramenta, "nome" | "argumentos" | "erro" | "notaId">, doFluxo: boolean) => {
        if (ferramenta.erro || !ferramenta.notaId) return;
        if (ferramenta.nome !== "criar_nota" && ferramenta.nome !== "editar_nota") return;
        if (doFluxo) avisadasNoFluxo.add(ferramenta.notaId);
        else if (avisadasNoFluxo.has(ferramenta.notaId)) return;
        const caminho = ferramenta.argumentos.caminho;
        if (ferramenta.nome === "criar_nota" && typeof caminho === "string" && caminho.trim()) aoNotaDoAgente?.({ id: ferramenta.notaId, ...dividirCaminho(caminho) });
        window.dispatchEvent(new CustomEvent("bimo:nota-alterada-pelo-agente", { detail: { id: ferramenta.notaId } }));
      };

      // As notas lidas viram as "Fontes" da resposta. Só o fluxo traz os ids delas.
      const dados = await lerRespostaDoChat(resposta, (linha) => {
        recebidos.push(linha);
        setPassosAoVivo((anteriores) => [...anteriores, linha]);
        const passo = passoDoRastro(linha);
        if (passo) aoPassoDoAgente?.(passo);
        if (passo?.tipo === "leitura" && !fontes.has(passo.id)) fontes.set(passo.id, { id: passo.id, titulo: tituloDaFonte(passo.id, linha, tituloDaNota) });
        avisarEscrita(linha, true);
      }, receberContexto);

      if (!perguntaGuardada) receberContexto(dados.anexos ?? []);

      const doAgente: TipoMensagem = {
        id: crypto.randomUUID(),
        papel: "agente",
        conteudo: dados.resposta,
        ferramentas: dados.ferramentas,
        fontes: [...fontes.values()],
      };
      setMensagens((anteriores) => [...anteriores, doAgente]);
      guardar(idDestaConversa, [doAgente]);
      onRespostaAgente?.();
      for (const ferramenta of dados.ferramentas) avisarEscrita(ferramenta, false);
    } catch (falha) {
      if (falha instanceof ErroDaRespostaDoChat && falha.indisponiveis.length) definirIndisponiveis(falha.indisponiveis);
      // Validação recusada: devolve o pedido ao campo sem duplicar no histórico.
      if (!perguntaGuardada) setMensagens((atuais) => atuais.filter((m) => m.id !== doUsuario.id));
      onRascunhoChange(rascunhoAtual.current.trim() ? `${texto}\n${rascunhoAtual.current}` : texto);
      // Falhou depois de gravar: a escrita aconteceu, então a conversa guarda os passos e o
      // "Abrir" da nota — sem isso a pessoa tentaria de novo e criaria a nota duas vezes.
      if (recebidos.some((linha) => !linha.erro && linha.notaId)) {
        const interrompida: TipoMensagem = { id: crypto.randomUUID(), papel: "agente", conteudo: RESPOSTA_INTERROMPIDA, ferramentas: recebidos, fontes: [...fontes.values()] };
        setMensagens((anteriores) => [...anteriores, interrompida]);
        guardar(idDestaConversa, [interrompida]);
      }
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não consegui falar com o agente. Tente de novo.",
      );
    } finally {
      setPensando(false);
      setPassosAoVivo([]);
      aoEncerrarResposta?.();
    }
  }

  const barraDoHistorico = conversas && (
    <HistoricoDeConversas
      cliente={conversas}
      antesDeListar={aguardarGravacoes}
      idAtual={idDaConversa}
      temMensagens={mensagens.length > 0 || idsDeContexto.length > 0}
      ocupado={pensando || abrindo}
      aoNovaConversa={novaConversa}
      aoEscolher={abrirConversa}
      aoExcluida={(id) => { if (id === idDaConversa) novaConversa(); }}
      noCabecalho={lugarDosBotoes !== undefined}
    />
  );

  function aoTeclar(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha — como na maioria dos chats.
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      enviar();
    }
  }

  function escolherSugestao(texto: string) {
    onRascunhoChange(texto);
    campo.current?.focus();
  }

  return (
    // Sem cor de fundo sólida aqui: é essa transparência que deixa o GrafoDeFundo
    // (renderizado atrás, no PaginaPrincipal) aparecer. A conversa fica embaixo e o
    // cérebro em cima (o grafo é enquadrado na parte de cima); as bolhas continuam opacas.
    <section className="flex h-full flex-col">
      {barraDoHistorico && lugarDosBotoes === undefined && barraDoHistorico}
      {barraDoHistorico && lugarDosBotoes && ativo && createPortal(barraDoHistorico, lugarDosBotoes)}

      {/* `relative`: o rótulo `sr-only` de cada mensagem é absoluto — sem um ancestral
          posicionado aqui, ele escapa do recorte do scroll e alonga o documento. A máscara
          apaga o topo da conversa quando ela sobe por cima do cérebro. */}
      <div className="relative flex-1 overflow-y-auto px-4 pt-6 pb-4 mask-t-from-85%">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-end gap-4">
          {mensagens.length === 0 && !pensando ? (
            <EstadoVazio onEscolher={escolherSugestao} />
          ) : (
            mensagens.map((mensagem) => (
              <Mensagem key={mensagem.id} mensagem={mensagem} aoAbrirNota={aoAbrirNota} aoMostrarNoCerebro={aoMostrarNoCerebro} />
            ))
          )}

          {pensando && <TurnoDoBimo passos={passosAoVivo} pensando />}

          {/* Âncora invisível: é para cá que a rolagem automática vai. O `-mt-4` desfaz o vão do `gap`. */}
          <div ref={fimDaLista} className="-mt-4" />
        </div>
      </div>

      <div className="border-t border-borda bg-painel/90 px-3 py-4 backdrop-blur-sm md:px-4">
        {erro && (
          <div className="mx-auto mb-2 max-w-2xl rounded-lg bg-erro-suave px-3 py-2 text-xs text-erro">
            {erro}
          </div>
        )}
        {avisoDoHistorico && (
          <p role="status" className="mx-auto mb-2 max-w-2xl rounded-lg bg-destaque-suave px-3 py-2 text-xs text-destaque-texto">
            {avisoDoHistorico}
            <button type="button" disabled={pensando || abrindo} onClick={tentarGuardarNovamente} className="ml-2 min-h-10 rounded-full px-3 text-controle text-texto underline disabled:opacity-50">Tentar guardar novamente</button>
          </p>
        )}

        <ContextoDoChat ids={idsDeContexto} notas={notasDisponiveis} abertas={notasAbertas} ocupado={pensando || abrindo} indisponiveis={indisponiveis.filter((id) => idsDeContexto.includes(id))} aoMudar={(ids) => { mudarContexto(ids); campo.current?.focus(); }} aoAbrir={aoAbrirNota} />
        {avisoDeContexto && <p role="status" className="mx-auto mb-2 max-w-2xl text-controle text-erro">{avisoDeContexto}</p>}
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <label className="flex min-w-0 flex-1">
            <span className="sr-only">Pergunta para o Bimo</span>
            <textarea
              ref={campo}
              rows={1}
              value={rascunho}
              onChange={(evento) => onRascunhoChange(evento.target.value)}
              onKeyDown={aoTeclar}
              placeholder="Pergunte, peça uma nota nova ou uma edição…"
              className="min-h-11 flex-1 resize-none rounded-card border border-borda bg-fundo px-3.5 py-2.5 text-sm outline-none placeholder:text-suave focus:border-destaque"
            />
          </label>

          {/* Botão primário do design system: pílula azul; desabilitado vira cinza quente. */}
          <button
            type="button"
            onClick={enviar}
            disabled={rascunho.trim() === "" || pensando || abrindo || idsDeContexto.some((id) => indisponiveis.includes(id))}
            className="h-11 shrink-0 rounded-full bg-destaque px-5 text-controle font-semibold text-sobre-destaque transition-[background-color,transform] hover:bg-destaque-hover disabled:cursor-not-allowed disabled:bg-desabilitado disabled:text-desabilitado-texto motion-safe:enabled:active:scale-[0.96] md:h-10"
          >
            Enviar
          </button>
        </div>
      </div>
    </section>
  );
}

/** O título de uma fonte: o atual da nota, senão o fim do caminho que o agente leu. */
function tituloDaFonte(id: IdDeNota, linha: LinhaDePasso, tituloDaNota?: (id: IdDeNota) => string | undefined): string {
  const atual = tituloDaNota?.(id);
  if (atual) return atual;
  const caminho = linha.argumentos?.caminho;
  return typeof caminho === "string" && caminho.trim() ? dividirCaminho(caminho).titulo : "Nota";
}

function EstadoVazio({ onEscolher }: { onEscolher: (texto: string) => void }) {
  return (
    <div className="flex flex-col items-center text-center motion-safe:animate-entrada">
      <h2 className="text-lg font-semibold text-balance">Converse com as suas notas</h2>
      <p className="mt-1.5 max-w-md text-controle text-pretty text-suave">
        Eu procuro, escrevo e mostro no cérebro por onde passei.
      </p>

      <div className="mt-4 flex w-full flex-col items-center gap-1.5">
        {SUGESTOES.map((sugestao) => (
          <button
            key={sugestao}
            type="button"
            onClick={() => onEscolher(sugestao)}
            className="min-h-10 max-w-full rounded-card border border-borda bg-painel px-4 py-2 text-controle text-pretty text-texto transition-[color,background-color,border-color,transform] hover:border-destaque-suave-borda hover:bg-destaque-suave motion-safe:active:scale-[0.98]"
          >
            {sugestao}
          </button>
        ))}
      </div>
    </div>
  );
}
