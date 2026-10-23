/**
 * O grafo de ligações entre notas, no estilo do "graph view" do Obsidian: cada
 * nota é um nó e cada `[[ligação]]` vira uma aresta até a nota citada. Como no
 * Obsidian, ligações para notas que ainda não existem viram nós "não
 * resolvidos" e, se a configuração pedir, tags viram nós.
 *
 * Pura: recebe as notas com o conteúdo já em mãos. De onde elas vêm (banco ou
 * memória) é assunto do repositório de notas.
 */

import { grupoDaPasta, normalizarTexto } from "./caminho-da-nota";
import { calcularGraus, type ConfiguracaoDoGrafo } from "./fisica-do-grafo";
import { construirIndiceDeLigacoes, type IndiceDeLigacoes, type NotaComConteudo } from "./indice-de-ligacoes";
import { extrairTags } from "./markdown-da-nota";

/**
 * Um nó do grafo. O `id` é o que as arestas referenciam: o id da nota, ou um
 * id com prefixo para os nós que não são notas. Os prefixos nunca colidem com
 * uma nota — um id de nota não contém `:`.
 */
export type NoDoGrafo =
  | { tipo: "nota"; id: string; titulo: string; grupo: string; neuronio?: true; nascidoEm?: string }
  | { tipo: "nao-resolvida"; id: string; titulo: string }
  | { tipo: "tag"; id: string; titulo: string };

export type ArestaDoGrafo = { de: string; para: string; tipo?: "notas" | "sinapse" | "neuronios" };

export type Grafo = {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /** Vai junto para o cliente: é dela que o `GrafoDeFundo` tira a física. */
  configuracao: ConfiguracaoDoGrafo;
  aviso?: string;
};

/**
 * Monta nós e arestas. Notas com `conteudo` vazio entram como nós, sem
 * ligações próprias.
 */
export function montarGrafoDeNotas({
  notas,
  configuracao,
  indice = construirIndiceDeLigacoes(notas),
  sinteses,
}: {
  notas: readonly NotaComConteudo[];
  configuracao: ConfiguracaoDoGrafo;
  /** O índice dessas mesmas notas, se quem chama já o tem — evita resolver todas as ligações duas vezes. */
  indice?: IndiceDeLigacoes;
  sinteses?: ReadonlyMap<string, { fontes: readonly { id: string }[] }>;
}): Grafo {

  const nosPorId = new Map<string, NoDoGrafo>(
    notas.map((nota) => [
      nota.id,
      { tipo: "nota", id: nota.id, titulo: nota.titulo, grupo: grupoDaPasta(nota.pasta), ...(sinteses?.has(nota.id) ? { neuronio: true as const, ...("criadoEm" in nota && typeof nota.criadoEm === "string" ? { nascidoEm: nota.criadoEm } : {}) } : {}) },
    ]),
  );

  const arestas: ArestaDoGrafo[] = [];
  // Cada par conta uma única vez. Sem isso o mesmo par entra várias vezes —
  // `A -> B` mais `B -> A` desenham a mesma linha. Duplicatas distorcem o
  // grafo duas vezes: multiplicam a força do link naquele par na simulação e
  // inflam o "grau", que define o tamanho da bolinha (criando hubs que não existem).
  const paresJaVistos = new Set<string>();
  const raizes = new Map([...(sinteses ?? [])].map(([id, p]) => [id, new Set(p.fontes.map((f) => f.id))]));

  function ligar(de: string, para: string) {
    if (de === para) return;
    // Par ordenado, então `A -> B` e `B -> A` geram a mesma chave. O `\n`
    // separa os dois ids sem ambiguidade: nenhum contém uma quebra de linha.
    const chave = [de, para].sort().join("\n");
    if (paresJaVistos.has(chave)) return;
    paresJaVistos.add(chave);
    const tipo = sinteses?.has(de) && sinteses.has(para) ? "neuronios"
      : raizes.get(de)?.has(para) || raizes.get(para)?.has(de) ? "sinapse" : "notas";
    arestas.push({ de, para, ...(sinteses?.size ? { tipo } : {}) });
  }

  function garantirNo(no: NoDoGrafo) {
    if (!nosPorId.has(no.id)) nosPorId.set(no.id, no);
  }

  for (const nota of notas) {
    for (const destino of indice.saidas.get(nota.id) ?? []) {
      if (destino.tipo === "nota") {
        ligar(nota.id, destino.id);
        continue;
      }
      if (configuracao.hideUnresolved) continue;

      const id = `nao-resolvida:${normalizarTexto(destino.alvo)}`;
      garantirNo({ tipo: "nao-resolvida", id, titulo: destino.titulo });
      ligar(nota.id, id);
    }

    if (configuracao.showTags) {
      for (const tag of extrairTags(nota.conteudo)) {
        const id = `tag:${tag.toLowerCase()}`;
        garantirNo({ tipo: "tag", id, titulo: `#${tag}` });
        ligar(nota.id, id);
      }
    }
  }

  let nos = [...nosPorId.values()];
  if (!configuracao.showOrphans) {
    const graus = calcularGraus(arestas);
    nos = nos.filter((no) => graus.has(no.id));
  }

  return { nos, arestas, configuracao };
}
