/**
 * Notas de exemplo do repositório em memória (`NOTAS_FONTE=memoria`): dão ao
 * desenvolvimento e aos testes de ponta a ponta um conjunto pequeno mas
 * completo — pastas, ligações entre notas, uma ligação que não resolve, tags e
 * um título repetido em pastas diferentes.
 */

import type { EntradaDeNota } from "./tipos";

export const NOTAS_DE_EXEMPLO: readonly EntradaDeNota[] = [
  {
    titulo: "Ler é uma conversa",
    pasta: "Leituras",
    tags: ["leitura", "hábitos"],
    conteudo: [
      "Marginália é resposta, não anotação. Quando escrevo no branco da página, estou discutindo com o autor.",
      "",
      "## O hábito",
      "",
      "Toda leitura vira uma conversa em três passos: cortar o trecho numa nota de [[Notas atômicas]], responder com as minhas palavras e ligar a uma nota que eu já tenho, como [[Café: variáveis]].",
      "",
      "- Marcar o trecho com que eu discordo",
      "- Escrever a resposta na própria margem",
      "- Ligar a uma nota antiga",
      "",
      "> A leitura só termina quando eu respondo.",
    ].join("\n"),
  },
  {
    titulo: "Notas atômicas",
    pasta: "Método",
    tags: ["método"],
    conteudo:
      "Uma ideia por nota, um título que seja uma afirmação. O resto é ligação. Veja [[Ler é uma conversa]] e o que ainda falta escrever sobre [[Zettelkasten]].",
  },
  {
    titulo: "Café: variáveis",
    conteudo: "Moagem, temperatura da água, tempo de extração. Mudar uma variável por vez.",
  },
  {
    titulo: "Semana de 22 a 28",
    pasta: "Diário",
    tags: ["diário"],
    conteudo: "O que rendeu: [[Ler é uma conversa]]. O que travou: a reforma. Ver [[Reforma do apartamento]].",
  },
  {
    titulo: "Reforma do apartamento",
    pasta: "Projetos",
    tags: ["projetos"],
    conteudo: "Ordem das etapas, orçamento por ambiente e o que ficou para depois.",
  },
  { titulo: "Resumo", pasta: "Leituras", conteudo: "Resumo da leitura do mês." },
  { titulo: "Resumo", pasta: "Projetos", conteudo: "Resumo do projeto. Ligado a [[Reforma do apartamento]]." },
];
