"use client";

import { useEffect, useReducer, useState, type Dispatch } from "react";
import type { IdDeNota } from "../types";
import { ESTADO_INICIAL, reduzir, type Acao, type EstadoDoEspaco } from "./estado";
import { carregarEstadoSalvo, salvarEstado } from "./persistencia";

/**
 * O estado das abas no componente: o redutor puro mais a memória do navegador.
 *
 * O primeiro desenho é sempre o estado inicial (servidor e navegador iguais, sem
 * diferença de hidratação); só depois de montado o que foi guardado é restaurado.
 * Por isso nada é gravado antes de `pronto`: gravar o estado inicial por cima do que
 * estava guardado apagaria as abas da pessoa antes de elas voltarem.
 *
 * `existentes` são os ids que ainda existem: o que sumiu (nota apagada em outro
 * dispositivo, por exemplo) sai das abas. Uma lista vazia é tratada pelo redutor como "ainda não sei".
 */
export function useEspacoDeTrabalho(existentes: ReadonlySet<IdDeNota>, protegidos?: ReadonlySet<IdDeNota>): {
  estado: EstadoDoEspaco;
  despachar: Dispatch<Acao>;
} {
  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const salvo = carregarEstadoSalvo();
    if (salvo) despachar({ tipo: "restaurar", estado: salvo });
    // Marca "já restaurei": só depois disso o estado pode ser gravado. É o ponto em que o navegador
    // (que o servidor não tem) começa a valer, o caso de uso de um efeito, e acontece uma única vez.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPronto(true);
  }, []);

  useEffect(() => {
    if (pronto) despachar({ tipo: "descartar-inexistentes", existentes, protegidos });
  }, [pronto, existentes, protegidos]);

  useEffect(() => {
    if (pronto) salvarEstado(estado);
  }, [pronto, estado]);

  return { estado, despachar };
}
