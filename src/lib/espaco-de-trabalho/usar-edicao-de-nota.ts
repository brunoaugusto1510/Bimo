"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { salvarNota, type RespostaDeNota } from "../cliente-de-notas";
import { criarSalvamentoAutomatico, type RetratoDaEdicao, type SalvamentoAutomatico } from "../edicao/salvamento-automatico";
import { criarRascunhoLocal, decidirRascunho, type RascunhoLocal } from "../edicao/rascunho-local";
import type { NotaCompleta } from "../repositorio-de-notas/tipos";

export type EscolhaDaEdicao = "manter" | "usar" | "copiar" | "restaurar" | "descartar" | "tentar";
export const EVENTO_NOTA_SALVA = "bimo:nota-salva";
const LIMITE_KEEPALIVE = 64 * 1024;

export function useEdicaoDeNota(id: string, dados: RespostaDeNota | undefined, editando: boolean, aoSalvar?: (nota: NotaCompleta, checkpoint: boolean) => void) {
  const [vista, definirVista] = useState<(RetratoDaEdicao & { id: string }) | null>(null);
  const [recuperacao, definirRecuperacao] = useState<{ id: string; rascunho: RascunhoLocal } | null>(null);
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
      if (escrita) void maquina.forcar({ checkpoint: true });
      maquina.destruir(); copia.destruir();
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
  const retrato = vista?.id === id ? vista : null;
  return {
    texto: retrato?.texto ?? dados?.nota.conteudo ?? "", nota: retrato?.nota ?? dados?.nota,
    estado: retrato?.estado ?? "salvo", aoMudar, forcar, resolverConflito,
    mensagem: retrato?.mensagem, avisoLocal,
    rascunhoRecuperado: recuperacao?.id === id,
    pendente: recuperacao?.id === id || (!!retrato && (retrato.texto !== retrato.nota.conteudo || retrato.estado === "salvando")),
  };
}
