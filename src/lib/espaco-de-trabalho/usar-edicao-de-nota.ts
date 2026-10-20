"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buscarNota, renomearNota, salvarNota, type RespostaDeNota, type ResultadoDoSalvamento } from "../cliente-de-notas";
import { criarSalvamentoAutomatico, type RetratoDaEdicao, type SalvamentoAutomatico } from "../edicao/salvamento-automatico";
import { criarRascunhoLocal, decidirRascunho, type RascunhoLocal } from "../edicao/rascunho-local";
import type { NotaCompleta } from "../repositorio-de-notas/tipos";
import { normalizarPasta } from "../caminho-da-nota";
import { mesmasTags, normalizarTags } from "../tags-da-nota";

type PedidoExclusivo = {
  verbo: string;
  substantivo: string;
  falha: string;
  chamar: (revisao: number) => Promise<ResultadoDoSalvamento | { tipo: "erro"; mensagem: string }>;
  /** Um conflito cujo salvo já é o que se pediu é só uma resposta perdida, não um conflito. */
  jaAplicado: (salva: NotaCompleta) => boolean;
  tituloEmUso: (nota: NotaCompleta) => string;
};

export type EscolhaDaEdicao = "manter" | "usar" | "copiar" | "restaurar" | "descartar" | "tentar";
export const EVENTO_NOTA_SALVA = "bimo:nota-salva";
export const EVENTO_NOTAS_REESCRITAS = "bimo:notas-reescritas";
const LIMITE_KEEPALIVE = 64 * 1024;

export function useEdicaoDeNota(id: string, dados: RespostaDeNota | undefined, editando: boolean, aoSalvar?: (nota: NotaCompleta, checkpoint: boolean) => void) {
  const [vista, definirVista] = useState<(RetratoDaEdicao & { id: string }) | null>(null);
  const [recuperacao, definirRecuperacao] = useState<{ id: string; rascunho: RascunhoLocal } | null>(null);
  // A aba reaproveita o hook ao navegar: cada nota tem a sua própria contagem de operações em voo.
  const [ocupadas, definirOcupadas] = useState<ReadonlyMap<string, number>>(new Map());
  const ocupado = (ocupadas.get(id) ?? 0) > 0;
  const marcarOcupada = useCallback((alvo: string, delta: 1 | -1) => definirOcupadas((atuais) => {
    const proximas = new Map(atuais), total = (atuais.get(alvo) ?? 0) + delta;
    if (total > 0) proximas.set(alvo, total); else proximas.delete(alvo);
    return proximas;
  }), []);
  const [avisoLocal, definirAvisoLocal] = useState("");
  const controle = useRef<{ id: string; maquina: SalvamentoAutomatico; copia: ReturnType<typeof criarRascunhoLocal> } | null>(null);
  const callback = useRef(aoSalvar);
  useEffect(() => { callback.current = aoSalvar; }, [aoSalvar]);
  const carregada = dados !== undefined;
  const escrita = dados?.capacidades.escrita ?? false;

  useEffect(() => {
    // A recuperação pertence à sessão carregada, nunca à navegação anterior.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    definirRecuperacao(null);
    if (!dados) return;
    let montado = true;
    const copia = criarRascunhoLocal(id, undefined, () => { if (montado) definirAvisoLocal("A cópia local não pôde ser gravada. Copie seu texto antes de sair."); });
    const rascunho = copia.ler();
    const decisao = decidirRascunho(rascunho, dados.nota);
    const maquina = criarSalvamentoAutomatico({
      nota: { ...dados.nota, conteudo: dados.nota.conteudo.replace(/\r\n/g, "\n") },
      salvar: (conteudo, revisaoBase, opcoes) => {
        // O tamanho é do JSON UTF-8, incluindo escapes e metadados, não o comprimento do texto.
        const corpo = JSON.stringify({ conteudo, revisaoBase, checkpoint: opcoes.checkpoint });
        if (opcoes.keepalive && new TextEncoder().encode(corpo).byteLength > LIMITE_KEEPALIVE) return Promise.reject(new Error("Cópia local preservada"));
        return salvarNota(id, { conteudo }, { revisaoBase, checkpoint: opcoes.checkpoint }, { keepalive: opcoes.keepalive });
      },
      aoMudar: (retrato) => { if (montado) definirVista({ ...retrato, id }); },
      aoSalvar: (nota, checkpoint) => {
        if (!montado) return;
        const atual = maquina.obter();
        copia.confirmar(nota.conteudo);
        // Uma resposta atrasada só atualiza a base da cópia, nunca o texto mais recente.
        if (atual.texto !== nota.conteudo) copia.guardar(atual.texto, nota.revisao);
        if (montado) {
          callback.current?.(nota, checkpoint);
          window.dispatchEvent(new CustomEvent(EVENTO_NOTA_SALVA, { detail: { id, checkpoint } }));
        }
      },
    });
    maquina.habilitar(escrita && editando);
    controle.current = { id, maquina, copia };
    if (decisao === "nenhum") copia.limpar();
    else if (rascunho) {
      if (decisao === "conflito") maquina.recuperarConflito(rascunho.conteudo, dados.nota);
      // Inicializa a cópia externa somente depois da hidratação, assim como a persistência das abas.
      else definirRecuperacao({ id, rascunho });
    }
    definirVista({ ...maquina.obter(), id });

    function aoSair() {
      copia.descarregar();
      const atual = maquina.obter();
      if (!escrita || !maquina.temAlteracoes() || atual.estado === "conflito" || maquina.emVoo()) return;
      const corpo = JSON.stringify({ conteudo: atual.texto, revisaoBase: atual.nota.revisao, checkpoint: true });
      if (new TextEncoder().encode(corpo).byteLength <= LIMITE_KEEPALIVE) void maquina.forcar({ checkpoint: true, keepalive: true });
    }
    function aoOcultar() { if (document.visibilityState === "hidden") aoSair(); }
    function antesDeSair(evento: BeforeUnloadEvent) {
      if (maquina.temAlteracoes() || maquina.obter().estado !== "salvo" || (decisao !== "nenhum" && copia.ler())) { copia.descarregar(); evento.preventDefault(); evento.returnValue = ""; }
    }
    function aoArmazenar(evento: StorageEvent) {
      if (evento.key !== `bimo_rascunho:${id}`) return;
      const externo = evento.newValue;
      if (externo) definirAvisoLocal("Outra janela alterou o rascunho desta nota. Seu texto continua nesta janela; copie-o antes de sair.");
    }
    document.addEventListener("visibilitychange", aoOcultar);
    window.addEventListener("pagehide", aoSair);
    window.addEventListener("beforeunload", antesDeSair);
    window.addEventListener("storage", aoArmazenar);
    return () => {
      montado = false;
      document.removeEventListener("visibilitychange", aoOcultar);
      window.removeEventListener("pagehide", aoSair);
      window.removeEventListener("beforeunload", antesDeSair);
      window.removeEventListener("storage", aoArmazenar);
      copia.descarregar();
      // Não bloquear navegação. O rascunho já foi descarregado mesmo se a rede falhar.
      // O backup já está descarregado. Uma instância desmontada não confirma nem apaga a cópia de uma nova.
      maquina.habilitar(false);
      if (escrita) void maquina.forcar({ checkpoint: true }).finally(() => maquina.destruir());
      else maquina.destruir();
      copia.destruir();
      if (controle.current?.maquina === maquina) controle.current = null;
    };
    // A sessão pertence à identidade carregada. Revisões devolvidas pela escrita não recriam a fila.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, carregada, escrita]);

  useEffect(() => {
    if (dados && controle.current?.id === id && recuperacao?.id !== id) {
      controle.current.maquina.adotar({ ...dados.nota, conteudo: dados.nota.conteudo.replace(/\r\n/g, "\n") });
    }
  }, [dados, id, recuperacao]);

  useEffect(() => {
    const atual = controle.current;
    if (!atual || atual.id !== id) return;
    atual.maquina.habilitar(escrita && editando);
    return () => { if (escrita && editando) { atual.copia.descarregar(); void atual.maquina.forcar({ checkpoint: true }); } };
  }, [id, escrita, editando]);

  useEffect(() => {
    const sinal = new AbortController();
    async function revalidar(evento: Event) {
      if ((evento as CustomEvent<{ id: string }>).detail.id === id) return;
      const atual = controle.current;
      if (!atual || atual.id !== id) return;
      try {
        await atual.maquina.revalidarReescrita(async () => (await buscarNota(id, sinal.signal)).nota);
        if (sinal.signal.aborted || controle.current !== atual) return;
        // O servidor informa apenas a quantidade reescrita: revalidamos todas as abas.
        const novo = atual.maquina.obter();
        atual.copia.confirmar(novo.nota.conteudo);
        if (novo.texto !== novo.nota.conteudo) atual.copia.guardar(novo.texto, novo.nota.revisao);
      } catch { /* Mantém texto e revisão locais; a próxima leitura pode tentar de novo. */ }
    }
    window.addEventListener(EVENTO_NOTAS_REESCRITAS, revalidar);
    return () => { sinal.abort(); window.removeEventListener(EVENTO_NOTAS_REESCRITAS, revalidar); };
  }, [id]);

  const aoMudar = useCallback((texto: string) => {
    const atual = controle.current;
    if (!atual || atual.id !== id || !escrita || !editando || recuperacao?.id === id) return;
    definirRecuperacao(null);
    atual.copia.guardar(texto, atual.maquina.obter().nota.revisao);
    atual.maquina.mudar(texto);
  }, [id, escrita, editando, recuperacao]);
  const forcar = useCallback((opcoes: { checkpoint: boolean }) => {
    const atual = controle.current;
    return atual?.id === id && escrita ? atual.maquina.forcar(opcoes) : Promise.resolve();
  }, [id, escrita]);
  async function resolverConflito(escolha: EscolhaDaEdicao) {
    const atual = controle.current;
    if (!atual || atual.id !== id) return;
    if (escolha === "tentar") { await atual.maquina.tentarNovamente(); return; }
    if (escolha === "restaurar" && recuperacao?.id === id) {
      atual.maquina.mudar(recuperacao.rascunho.conteudo); definirRecuperacao(null); return;
    }
    if (escolha === "descartar") { atual.copia.limpar(); definirRecuperacao(null); return; }
    if (escolha === "copiar") {
      try { await navigator.clipboard.writeText(atual.maquina.obter().texto); } catch { throw new Error("Não foi possível copiar. Sua versão foi preservada."); }
      return;
    }
    await atual.maquina.resolver(escolha === "manter" ? "manter" : "usar");
    const retrato = atual.maquina.obter();
    if (escolha !== "manter") { atual.copia.limpar(); callback.current?.(retrato.nota, false); }
  }
  /**
   * Uma escrita que não pode correr junto do autosave (renomear, pasta, tags): salva o texto pendente,
   * ocupa a fila, adota a nota devolvida e avisa as outras abas se ligações foram reescritas.
   */
  async function escreverExclusivo(pedido: PedidoExclusivo): Promise<{ nota: NotaCompleta; notasReescritas: number }> {
    const atual = controle.current;
    if (!escrita || !atual || atual.id !== id || recuperacao?.id === id) throw new Error(`A nota não está disponível para ${pedido.verbo}.`);
    marcarOcupada(id, 1);
    try {
      return await atual.maquina.executarExclusivo(async (revisao) => {
        const textoEnviado = atual.maquina.obter().texto;
        const resultado = await pedido.chamar(revisao);
        const respostaPerdida = resultado.tipo === "conflito" && pedido.jaAplicado(resultado.atual) && resultado.atual.conteudo === atual.maquina.obter().nota.conteudo;
        if (resultado.tipo === "ok" || respostaPerdida) {
          const salva = resultado.tipo === "ok" ? resultado.nota : resultado.atual;
          atual.maquina.rebasear(salva, textoEnviado);
          const retrato = atual.maquina.obter();
          if (retrato.estado === "conflito") throw new Error(`O conteúdo mudou durante a ${pedido.substantivo}. Resolva o conflito.`);
          const notasReescritas = resultado.tipo === "ok" ? resultado.notasReescritas ?? 0 : 0;
          const resposta = { nota: salva, notasReescritas };
          // As outras abas precisam revalidar mesmo que esta máquina já tenha sido trocada (navegou e voltou).
          const reescreveu = resultado.tipo === "conflito" || notasReescritas > 0;
          const avisarReescrita = () => window.dispatchEvent(new CustomEvent(EVENTO_NOTAS_REESCRITAS, { detail: { id } }));
          if (controle.current !== atual) {
            if (reescreveu) avisarReescrita();
            // Navegou para outra nota e voltou enquanto o pedido corria: a máquina nova adota a revisão devolvida.
            if (controle.current?.id === id) controle.current.maquina.adotar({ ...salva, conteudo: salva.conteudo.replace(/\r\n/g, "\n") });
            window.dispatchEvent(new CustomEvent(EVENTO_NOTA_SALVA, { detail: { id, checkpoint: true } }));
            return resposta;
          }
          atual.copia.confirmar(salva.conteudo);
          if (retrato.texto !== salva.conteudo) atual.copia.guardar(retrato.texto, salva.revisao);
          callback.current?.(salva, true);
          window.dispatchEvent(new CustomEvent(EVENTO_NOTA_SALVA, { detail: { id, checkpoint: true } }));
          if (reescreveu) avisarReescrita();
          return resposta;
        }
        if (resultado.tipo === "conflito") atual.maquina.recuperarConflito(atual.maquina.obter().texto, resultado.atual);
        throw new Error(resultado.tipo === "erro" ? resultado.mensagem : resultado.tipo === "titulo-em-uso" ? pedido.tituloEmUso(atual.maquina.obter().nota) : resultado.tipo === "somente-leitura" ? "As notas estão em modo somente leitura." : pedido.falha);
      });
    } finally {
      marcarOcupada(id, -1);
    }
  }
  const retrato = vista?.id === id ? vista : null;
  return {
    texto: retrato?.texto ?? dados?.nota.conteudo ?? "", nota: retrato?.nota ?? dados?.nota,
    estado: retrato?.estado ?? "salvo", ocupado, aoMudar, forcar, resolverConflito,
    renomear: (titulo: string) => escreverExclusivo({
      verbo: "renomear", substantivo: "renomeação", falha: "Não foi possível renomear a nota.",
      chamar: (revisao) => renomearNota(id, titulo, revisao),
      jaAplicado: (salva) => salva.titulo === titulo,
      tituloEmUso: () => "Já existe uma nota com esse título nessa pasta.",
    }),
    /** Pasta e tags passam pela mesma fila da renomeação: o texto pendente é salvo antes e vira checkpoint. */
    atualizarMetadados(mudancas: { pasta?: string | null; tags?: string[] }) {
      const pasta = mudancas.pasta === undefined ? undefined : normalizarPasta(mudancas.pasta);
      const tags = mudancas.tags === undefined ? undefined : normalizarTags(mudancas.tags);
      return escreverExclusivo({
        verbo: "alterar", substantivo: "alteração", falha: "Não foi possível salvar a pasta e as tags.",
        chamar: (revisao) => salvarNota(id, { ...(pasta !== undefined && { pasta }), ...(tags && { tags }) }, { revisaoBase: revisao, checkpoint: true }),
        jaAplicado: (salva) => (pasta === undefined || (salva.pasta ?? "").toLowerCase() === (pasta ?? "").toLowerCase()) && (tags === undefined || mesmasTags(salva.tags, tags)),
        tituloEmUso: (nota) => `Já existe «${nota.titulo}» nessa pasta.`,
      });
    },
    mensagem: retrato?.mensagem, avisoLocal,
    rascunhoRecuperado: recuperacao?.id === id,
    pendente: recuperacao?.id === id || (!!retrato && (retrato.texto !== retrato.nota.conteudo || retrato.estado === "salvando")),
  };
}
