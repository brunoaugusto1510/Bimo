import type { ItemVault } from "./types";

/**
 * Vault de mentira, só para a interface ter o que desenhar.
 *
 * Na etapa em que ligarmos o GitHub, esta constante some e a mesma árvore
 * passa a vir da API do repositório do Obsidian. O formato (`ItemVault`) é o
 * mesmo nos dois casos — por isso a barra lateral não vai precisar mudar.
 */
export const vaultExemplo: ItemVault[] = [
  {
    tipo: "pasta",
    nome: "Conhecimento",
    filhos: [
      { tipo: "nota", nome: "Como eu estudo", caminho: "Conhecimento/Como eu estudo.md" },
      { tipo: "nota", nome: "Zettelkasten", caminho: "Conhecimento/Zettelkasten.md" },
      {
        tipo: "pasta",
        nome: "Programação",
        filhos: [
          { tipo: "nota", nome: "TypeScript básico", caminho: "Conhecimento/Programação/TypeScript básico.md" },
          { tipo: "nota", nome: "React - hooks", caminho: "Conhecimento/Programação/React - hooks.md" },
          { tipo: "nota", nome: "Git no dia a dia", caminho: "Conhecimento/Programação/Git no dia a dia.md" },
        ],
      },
    ],
  },
  {
    tipo: "pasta",
    nome: "Faculdade",
    filhos: [
      { tipo: "nota", nome: "Banco de dados - normalização", caminho: "Faculdade/Banco de dados - normalização.md" },
      { tipo: "nota", nome: "Redes - modelo OSI", caminho: "Faculdade/Redes - modelo OSI.md" },
      { tipo: "nota", nome: "Resumo para a prova", caminho: "Faculdade/Resumo para a prova.md" },
    ],
  },
  {
    tipo: "pasta",
    nome: "Trabalho",
    filhos: [
      { tipo: "nota", nome: "Reuniões - semana 32", caminho: "Trabalho/Reuniões - semana 32.md" },
      { tipo: "nota", nome: "Processos internos", caminho: "Trabalho/Processos internos.md" },
    ],
  },
  {
    tipo: "pasta",
    nome: "Projetos",
    filhos: [
      { tipo: "nota", nome: "Personal Brain", caminho: "Projetos/Personal Brain.md" },
      { tipo: "nota", nome: "Ideias soltas", caminho: "Projetos/Ideias soltas.md" },
    ],
  },
  { tipo: "nota", nome: "Inbox", caminho: "Inbox.md" },
];
