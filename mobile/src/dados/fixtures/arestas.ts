import type { Aresta } from "../tipos";

// Cada nó fica com 3 a 7 vizinhos; a contagem aqui bate com `conexoes` em
// `notas.ts` para cada id (grafo simples, sem arestas repetidas).
export const arestas: Aresta[] = [
  { de: "notas-atomicas", para: "ligacao-forte-versus-ligacao-fraca" },
  { de: "notas-atomicas", para: "hub-nao-e-indice" },
  { de: "notas-atomicas", para: "friccao-de-captura" },
  { de: "notas-atomicas", para: "reescrever-e-pensar-de-novo" },
  { de: "notas-atomicas", para: "bimo-v0-leitor-de-vault" },
  { de: "notas-atomicas", para: "reuniao-sobre-o-roadmap-do-bimo" },
  { de: "notas-atomicas", para: "frase-curta-carrega-uma-ideia" },
  { de: "ligacao-forte-versus-ligacao-fraca", para: "hub-nao-e-indice" },
  { de: "ligacao-forte-versus-ligacao-fraca", para: "friccao-de-captura" },
  { de: "ligacao-forte-versus-ligacao-fraca", para: "bimo-v0-leitor-de-vault" },
  { de: "hub-nao-e-indice", para: "bimo-v0-leitor-de-vault" },
  { de: "hub-nao-e-indice", para: "migracao-do-vault-para-github" },
  { de: "friccao-de-captura", para: "prototipo-mobile-em-expo" },
  { de: "reescrever-e-pensar-de-novo", para: "frase-curta-carrega-uma-ideia" },
  { de: "reescrever-e-pensar-de-novo", para: "segundo-cerebro-e-infraestrutura-nao-habito" },
  { de: "bimo-v0-leitor-de-vault", para: "migracao-do-vault-para-github" },
  { de: "bimo-v0-leitor-de-vault", para: "prototipo-mobile-em-expo" },
  { de: "bimo-v0-leitor-de-vault", para: "piloto-do-agente-com-function-calling" },
  { de: "migracao-do-vault-para-github", para: "prototipo-mobile-em-expo" },
  { de: "migracao-do-vault-para-github", para: "piloto-do-agente-com-function-calling" },
  { de: "piloto-do-agente-com-function-calling", para: "reuniao-sobre-o-roadmap-do-bimo" },
  { de: "piloto-do-agente-com-function-calling", para: "terca-de-revisao-lenta" },
  { de: "terca-de-revisao-lenta", para: "retomada-depois-das-ferias" },
  { de: "terca-de-revisao-lenta", para: "reuniao-sobre-o-roadmap-do-bimo" },
  { de: "retomada-depois-das-ferias", para: "reuniao-sobre-o-roadmap-do-bimo" },
  { de: "retomada-depois-das-ferias", para: "segundo-cerebro-e-infraestrutura-nao-habito" },
  { de: "frase-curta-carrega-uma-ideia", para: "segundo-cerebro-e-infraestrutura-nao-habito" },
];
