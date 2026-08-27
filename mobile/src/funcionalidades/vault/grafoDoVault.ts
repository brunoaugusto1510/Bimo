import type { Aresta, Nota, NoDoGrafo } from "@/dados/tipos";

const PESO_MINIMO = 0.6;
const PESO_MAXIMO = 1.8;

function embaralharEstavel(id: string): number {
  let acumulado = 0;
  for (let i = 0; i < id.length; i += 1) acumulado = (acumulado * 31 + id.charCodeAt(i)) % 100000;
  return acumulado / 100000;
}

// Layout em círculo com raio embaralhado de forma estável pelo id: sem
// motor de física, determinístico. Posições fixas bastam — não há deriva
// nem simulação aqui, ao contrário do campo de fundo em modo "ambiente".
export function montarGrafo(notas: Nota[], _arestas: Aresta[]): NoDoGrafo[] {
  const conexoes = notas.map((nota) => nota.conexoes);
  const menor = Math.min(...conexoes);
  const maior = Math.max(...conexoes);
  const amplitude = maior - menor || 1;

  return notas.map((nota, indice) => {
    const angulo = (indice / notas.length) * Math.PI * 2;
    const distancia = 0.2 + embaralharEstavel(nota.id) * 0.3;

    return {
      id: nota.id,
      titulo: nota.titulo,
      x: 0.5 + Math.cos(angulo) * distancia,
      y: 0.5 + Math.sin(angulo) * distancia,
      peso: PESO_MINIMO + ((nota.conexoes - menor) / amplitude) * (PESO_MAXIMO - PESO_MINIMO),
    };
  });
}

export function vizinhosDe(id: string, arestas: Aresta[]): string[] {
  const vizinhos = new Set<string>();
  for (const aresta of arestas) {
    if (aresta.de === id) vizinhos.add(aresta.para);
    if (aresta.para === id) vizinhos.add(aresta.de);
  }
  return [...vizinhos];
}

export function filtrarNotas(notas: Nota[], busca: string, noSelecionado: string | null, arestas: Aresta[]): Nota[] {
  const base =
    noSelecionado === null
      ? notas
      : (() => {
          const permitidos = new Set([noSelecionado, ...vizinhosDe(noSelecionado, arestas)]);
          return notas.filter((nota) => permitidos.has(nota.id));
        })();

  const termo = busca.trim().toLowerCase();
  if (termo.length === 0) return base;

  return base.filter(
    (nota) => nota.titulo.toLowerCase().includes(termo) || nota.resumo.toLowerCase().includes(termo),
  );
}
