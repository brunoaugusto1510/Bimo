"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buscarLigacoes, buscarNota, ErroDoCliente, type RespostaDeNota } from "../cliente-de-notas";
import type { LigacoesDaNota } from "../servico-de-notas";
import type { IdDeNota } from "../types";

type Resultado<T> = { chave: string; tipo: "pronto"; dados: T } | { chave: string; tipo: "erro"; mensagem: string; status?: number };

export type PedidoDeNota<T> = {
  estado: "carregando" | "pronto" | "erro";
  dados?: T;
  mensagem?: string;
  /** O status HTTP da recusa, quando houve uma (401 = sessão expirada, 404 = a nota sumiu). */
  status?: number;
  recarregar: () => void;
};

/**
 * Um pedido que depende de `id`: carrega, entrega o dado ou o erro, cancela o pedido
 * quando o `id` troca (ou o componente sai) e ignora uma resposta que chega depois de
 * já não ser a da nota atual. `recarregar` refaz o pedido depois de uma falha.
 */
function usePedido<T>(id: IdDeNota | null, buscar: (id: IdDeNota, sinal: AbortSignal) => Promise<T>, habilitado = true, podeRevalidar?: () => boolean): PedidoDeNota<T> {
  const [tentativa, setTentativa] = useState(0);
  const [resultados, setResultados] = useState<ReadonlyMap<string, Resultado<T>>>(new Map());
  const permissao = useRef(podeRevalidar);
  const cache = useRef(resultados);
  useEffect(() => { permissao.current = podeRevalidar; cache.current = resultados; }, [podeRevalidar, resultados]);
  const chave = `${id}:${tentativa}`;

  useEffect(() => {
    if (id === null || !habilitado || (cache.current.get(id)?.tipo === "pronto" && permissao.current?.() === false)) return;

    const controle = new AbortController();
    // Um pedido cancelado pode terminar mesmo assim (nem todo `fetch` obedece na hora): o que ele
    // trouxer é de uma nota que já não está na tela e não pode sobrescrever o resultado da atual.
    buscar(id, controle.signal)
      .then((dados) => {
        if (!controle.signal.aborted) setResultados((anteriores) => new Map(anteriores).set(id, { chave, tipo: "pronto", dados }));
      })
      .catch((erro: unknown) => {
        if (controle.signal.aborted || (erro instanceof DOMException && erro.name === "AbortError")) return;
        const mensagem = erro instanceof Error ? erro.message : "Não consegui carregar.";
        setResultados((anteriores) => anteriores.get(id)?.tipo === "pronto" ? anteriores : new Map(anteriores).set(id, { chave, tipo: "erro", mensagem, status: erro instanceof ErroDoCliente ? erro.status : undefined }));
      });

    return () => controle.abort();
    // `buscar` é sempre uma função de módulo, estável: recriá-la não deve refazer o pedido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tentativa, habilitado]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  // Só vale o resultado desta nota e desta tentativa; qualquer outro é de um pedido que já passou.
  const atual = resultados.get(id ?? "");
  if (atual?.tipo === "pronto") return { estado: "pronto", dados: atual.dados, recarregar };
  if (atual?.tipo === "erro" && atual.chave === chave) return { estado: "erro", mensagem: atual.mensagem, status: atual.status, recarregar };
  return { estado: "carregando", recarregar };
}

export function useNota(id: IdDeNota | null, ativa = true, podeRevalidar?: () => boolean): PedidoDeNota<RespostaDeNota> {
  return usePedido(id, buscarNota, ativa, podeRevalidar);
}

export function useLigacoes(id: IdDeNota | null): PedidoDeNota<LigacoesDaNota> {
  return usePedido(id, buscarLigacoes);
}
