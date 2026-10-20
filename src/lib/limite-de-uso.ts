/** Limite por instância, em memória: melhor esforço, sem garantia entre servidores. */
export function criarLimitadorDeUso({ maximo, janelaMs, agora = () => Date.now() }: {
  maximo: number; janelaMs: number; agora?: () => number;
}) {
  const registros = new Map<string, number[]>();
  return {
    tentar(chave: string): { permitido: true } | { permitido: false; esperarSegundos: number } {
      const instante = agora();
      for (const [chaveAtual, instantes] of registros) {
        const recentes = instantes.filter((valor) => valor > instante - janelaMs);
        if (recentes.length) registros.set(chaveAtual, recentes);
        else registros.delete(chaveAtual);
      }
      const recentes = registros.get(chave) ?? [];
      if (recentes.length >= maximo) {
        return { permitido: false, esperarSegundos: Math.ceil((recentes[0] + janelaMs - instante) / 1000) };
      }
      recentes.push(instante);
      registros.set(chave, recentes);
      return { permitido: true };
    },
  };
}
