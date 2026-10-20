"use client";

import { useEffect, useState } from "react";
import { buscarTags } from "../cliente-de-notas";
import { EVENTO_NOTA_SALVA } from "./usar-edicao-de-nota";

/** Depois de salvar, espera a digitação assentar antes de pedir as tags de novo. */
const ATRASO_DA_ATUALIZACAO_MS = 2000;

/** Uma consulta por vez, compartilhada por todos os editores abertos; some do cache ao falhar ou ao salvar uma nota. */
let consulta: Promise<string[]> | null = null;

function carregar(): Promise<string[]> {
  if (!consulta) {
    const pedido = buscarTags().then((tags) => tags.map((tag) => tag.nome)).catch(() => {
      // As sugestões são um extra: falhar não pode virar erro na tela, só uma lista vazia.
      if (consulta === pedido) consulta = null;
      return [];
    });
    consulta = pedido;
  }
  return consulta;
}

/** Só para os testes: começa de um cache vazio. */
export function esquecerTagsDasNotas(): void { consulta = null; }

/** Os nomes das tags em uso nas notas (da mais usada à menos), para completar `#` e o campo de tags. */
export function useTagsDasNotas(habilitado: boolean): string[] {
  const [nomes, definirNomes] = useState<string[]>([]);
  useEffect(() => {
    if (!habilitado) return;
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void carregar().then((lista) => { if (ativo) definirNomes(lista); });
    function aoSalvar(evento: Event) {
      // Autosave no meio da digitação não pede tudo de novo: só o checkpoint (Ctrl+S, sair, pasta, tags).
      if (!(evento as CustomEvent<{ checkpoint?: boolean }>).detail?.checkpoint) return;
      consulta = null;
      clearTimeout(timer);
      timer = setTimeout(() => { void carregar().then((lista) => { if (ativo) definirNomes(lista); }); }, ATRASO_DA_ATUALIZACAO_MS);
    }
    window.addEventListener(EVENTO_NOTA_SALVA, aoSalvar);
    return () => { ativo = false; clearTimeout(timer); window.removeEventListener(EVENTO_NOTA_SALVA, aoSalvar); };
  }, [habilitado]);
  return nomes;
}
