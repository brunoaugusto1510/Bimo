import {
  caminhoMaisCurto,
  quadroDoRastro,
  type BuscadorDeCaminho,
  type QuadroDoRastro,
  type Rastro,
} from "./rastro-do-agente";

export type CacheDeCaminhos = {
  /** O buscador a usar neste quadro; zera o cache se `vizinhos` ou `rastro` mudaram de objeto. */
  buscador: (vizinhos: ReadonlyMap<string, ReadonlySet<string>>, rastro: object | null) => BuscadorDeCaminho;
  tamanho: () => number;
};

/**
 * `quadroDoRastro` pede o caminho de cada trecho a cada quadro; uma busca em largura
 * por trecho por quadro pesa. O resultado só muda com o grafo ou com o rastro, então
 * fica guardado (inclusive "sem caminho") até um dos dois trocar de objeto.
 */
export function criarCacheDeCaminhos(): CacheDeCaminhos {
  const guardados = new Map<string, string[] | null>();
  let vizinhosAtuais: ReadonlyMap<string, ReadonlySet<string>> | null = null;
  let rastroAtual: object | null | undefined;

  const buscar =
    (vizinhos: ReadonlyMap<string, ReadonlySet<string>>): BuscadorDeCaminho =>
    (de, para) => {
      const chave = `${de}|${para}`;
      if (!guardados.has(chave)) guardados.set(chave, caminhoMaisCurto(vizinhos, de, para));
      return guardados.get(chave) ?? null;
    };

  return {
    buscador: (vizinhos, rastro) => {
      if (vizinhos !== vizinhosAtuais || rastro !== rastroAtual) {
        guardados.clear();
        vizinhosAtuais = vizinhos;
        rastroAtual = rastro;
      }
      return buscar(vizinhos);
    },
    tamanho: () => guardados.size,
  };
}

/**
 * `quadroDoRastro` com o cache de caminhos embutido e, quando o rastro já terminou de
 * animar (`ativo` falso), o quadro pronto reaproveitado: ele não muda mais, e o grafo
 * segue redesenhando a 60 quadros por segundo.
 */
export function criarQuadroDoRastroMemoizado(): (
  rastro: Rastro | null,
  agora: number,
  vizinhos: ReadonlyMap<string, ReadonlySet<string>>,
) => QuadroDoRastro {
  const caminhos = criarCacheDeCaminhos();
  let ultimo: { rastro: Rastro | null; vizinhos: object; quadro: QuadroDoRastro } | null = null;

  return (rastro, agora, vizinhos) => {
    if (ultimo && ultimo.rastro === rastro && ultimo.vizinhos === vizinhos) return ultimo.quadro;
    const quadro = quadroDoRastro(rastro, agora, caminhos.buscador(vizinhos, rastro));
    ultimo = quadro.ativo ? null : { rastro, vizinhos, quadro };
    return quadro;
  };
}
