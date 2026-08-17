/**
 * Cor de cada nó do grafo, por grupo de pasta.
 *
 * Cada grupo (primeiro segmento do caminho — ver `obterGrupoDoCaminho` em
 * `grafo.ts`) recebe uma das cores fixas definidas em `globals.css`
 * (`--grafo-cor-1` a `--grafo-cor-8`).
 *
 * A atribuição é por *ordem alfabética do nome do grupo*, não por hash. Hash
 * parece atraente ("a cor de um grupo nunca muda"), mas jogar poucos grupos em
 * 8 baldes colide quase sempre — com 7 grupos a chance de dois caírem na mesma
 * cor passa de 99%, e o grafo inteiro fica com 3 cores. Ordenar por nome
 * garante cores distintas enquanto couberem nos slots, e continua estável
 * entre recarregamentos: a ordem só muda se aparecer um grupo novo
 * alfabeticamente antes dos outros.
 *
 * Sobre a paleta: a ordem e os tons (claro/escuro) foram validados com o
 * script de acessibilidade do skill de dataviz para pares *adjacentes*. Num
 * grafo todos os grupos aparecem ao mesmo tempo, cenário em que a validação
 * estrita cobre menos slots — a escolha aqui é consciente, porque a cor no
 * grafo é um reforço visual decorativo: a identidade real de cada nota vem da
 * barra lateral e do leitor, nunca só da cor da bolinha.
 */

export const NUMERO_DE_CORES_DE_GRUPO = 8;

/**
 * Mapa grupo -> índice de cor (0 a NUMERO_DE_CORES_DE_GRUPO - 1).
 *
 * Passando de 8 grupos as cores voltam a repetir (o `%`) — é o limite da
 * paleta, e num vault com tantas pastas de topo alguma repetição é inevitável.
 */
export function criarMapaDeCoresPorGrupo(grupos: Iterable<string>): Map<string, number> {
  const nomesUnicos = [...new Set(grupos)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return new Map(nomesUnicos.map((nome, i) => [nome, i % NUMERO_DE_CORES_DE_GRUPO]));
}
